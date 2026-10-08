package ru.probpera.literaryplanet;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.SystemClock;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.system.Os;
import android.system.OsConstants;
import android.system.StructStat;
import android.util.AtomicFile;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/** Private native CHILD data coordinator, deliberately not a Capacitor plugin.
 * A Lease partitions data; it is not PIN/profile/package/rights admission. The
 * future admitted host must compile its callbacks into native batch requests.
 * All four purposes commit as one encrypted AtomicFile snapshot. Cooperating
 * native instances/processes use the same process/file lock for activation,
 * retirement, read and CAS. No Preferences/Auth/ParentVault fallback exists.
 * Ordinary Keystore AES is confidentiality, never an anti-rollback checkpoint.
 * Cancellation is ordered at this lock; an acknowledged cancellation cannot
 * precede a later commit. A failure after publication is an unknown ack, not a
 * promise of rollback. Already copied caller data cannot be erased here. */
final class PlanetChildDataStore {
    static final int MAX_VALUE_BYTES = 8 * 1024 * 1024, MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
    static final int MAX_SLOTS = 4096, MAX_BATCH = 64;
    private static final long MAX_SAFE = 9007199254740991L;
    private static final ReentrantLock PROCESS_LOCK = new ReentrantLock();
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Context context;
    private final String name, identity;
    private Lease active;
    private boolean closed;
    enum Purpose { search, history, cache, offline }
    static final class Unavailable extends Exception { Unavailable() { super("child-data-unavailable"); } }
    static final class Scope {
        final String profileId, locale, policyVersion, policyChecksum, packageId, packageChecksum;
        final long profileRevision, packageVersion;
        final int exactAge;
        private final String tuple;
        Scope(String profileId, long profileRevision, int exactAge, String locale, String policyVersion,
              String policyChecksum, String packageId, long packageVersion, String packageChecksum) throws Exception {
            require(identifier(profileId) && positive(profileRevision) && exactAge >= 3 && exactAge <= 17
                && ("ru".equals(locale) || "en".equals(locale)) && identifier(policyVersion) && checksum(policyChecksum)
                && identifier(packageId) && positive(packageVersion) && checksum(packageChecksum));
            this.profileId = profileId; this.profileRevision = profileRevision; this.exactAge = exactAge; this.locale = locale;
            this.policyVersion = policyVersion; this.policyChecksum = policyChecksum; this.packageId = packageId;
            this.packageVersion = packageVersion; this.packageChecksum = packageChecksum;
            tuple = new JSONArray().put(1).put("child").put(profileId).put(profileRevision).put(exactAge).put(locale)
                .put(policyVersion).put(policyChecksum).put(packageId).put(packageVersion).put(packageChecksum).toString();
        }
        String key(Purpose purpose) { return "probpera-child-v1/" + purpose.name() + "/" + hex(tuple.getBytes(StandardCharsets.US_ASCII)); }
        String itemKey(Purpose purpose, String kind, String id) throws Exception {
            require((purpose == Purpose.cache || purpose == Purpose.offline) && entityKind(kind) && identifier(id)
                && (purpose != Purpose.offline || "offline-package".equals(kind)));
            return key(purpose) + "/item/" + kind + "/" + id;
        }
        private static Scope decode(String tuple) throws Exception {
            StrictJson.validate(tuple); JSONArray a = new JSONArray(tuple); require(a.length() == 11
                && integer(a.get(0), 1, 1) == 1 && "child".equals(a.get(1)));
            Scope scope = new Scope(text(a.get(2)), integer(a.get(3), 1, MAX_SAFE), (int) integer(a.get(4), 3, 17),
                text(a.get(5)), text(a.get(6)), text(a.get(7)), text(a.get(8)), integer(a.get(9), 1, MAX_SAFE), text(a.get(10)));
            require(scope.tuple.equals(tuple)); return scope;
        }
    }
    /** Native-created opaque object, never constructible from JS or JSON. */
    static final class Lease {
        private final PlanetChildDataStore owner; private final Scope scope; private final long generation; private final String nonce; private final PlanetChildVault.LocalV2DataAdmission admission;
        private Lease(PlanetChildDataStore owner, Scope scope, long generation, String nonce) {
            this.owner = owner; this.scope = scope; this.generation = generation; this.nonce = nonce; admission=null;
        }
        // Partition metadata only; the opaque constructor and owner stay private.
        long partitionGeneration() { return generation; }
        String partitionNonce() { return nonce; }
        private Lease(PlanetChildDataStore owner,Scope scope,long generation,String nonce,PlanetChildVault.LocalV2DataAdmission admission){this.owner=owner;this.scope=scope;this.generation=generation;this.nonce=nonce;this.admission=admission;}
    }
    static final class Cancellation {
        private final PlanetChildDataStore owner; private final Lease lease; private final long deadline;
        private boolean cancelled, used;
        private Cancellation(PlanetChildDataStore owner, Lease lease, long deadline) { this.owner = owner; this.lease = lease; this.deadline = deadline; }
    }
    static final class ReadKey {
        final Purpose purpose; final String key;
        ReadKey(Purpose purpose, String key) throws Exception { require(purpose != null && key != null && key.length() <= 4096); this.purpose = purpose; this.key = key; }
    }
    static final class Mutation implements AutoCloseable {
        final Purpose purpose; final String key; final long expectedRevision;
        private byte[] value; private boolean disposed;
        Mutation(Purpose purpose, String key, long expectedRevision, byte[] value) throws Exception {
            require(purpose != null && key != null && key.length() <= 4096 && expectedRevision >= 0 && expectedRevision < MAX_SAFE-1
                && value != null && value.length > 0 && value.length <= MAX_VALUE_BYTES);
            this.purpose = purpose; this.key = key; this.expectedRevision = expectedRevision; this.value = value.clone();
        }
        private synchronized byte[] copy(int remainingBytes) throws Exception { require(!disposed && remainingBytes >= 0 && value.length <= remainingBytes); return value.clone(); }
        public synchronized void close() { disposed = true; Arrays.fill(value, (byte) 0); }
    }
    static final class Slot implements AutoCloseable {
        final long revision; final String checksum;
        private byte[] value; private boolean disposed;
        private Slot(long revision, byte[] value) throws Exception { this.revision = revision; this.value = value == null ? null : value.clone(); this.checksum = value == null ? null : digest(value); }
        synchronized byte[] copyValue() throws Exception { require(!disposed); return value == null ? null : value.clone(); }
        public synchronized void close() { disposed = true; if (value != null) Arrays.fill(value, (byte) 0); }
    }
    static final class Result implements AutoCloseable {
        private final Map<String, Slot> reads;
        private Result(Map<String, Slot> reads) { this.reads = Collections.unmodifiableMap(reads); }
        Slot get(Purpose purpose, String key) { return reads.get(purpose.name() + "\n" + key); }
        public void close() { for (Slot slot : reads.values()) slot.close(); }
    }
    private static final class Stored { final long revision; final byte[] value; Stored(long revision, byte[] value) { this.revision = revision; this.value = value; } }
    private static final class Seal {final Scope scope;final String contentBinding;private Seal(Scope scope,String contentBinding){this.scope=scope;this.contentBinding=contentBinding;}}
    private static final class State implements AutoCloseable {
        long generation; String nonce; Scope scope; String admissionBinding,pendingMigration; final TreeMap<String,Seal> seals=new TreeMap<>(); final TreeMap<String, Stored> entries = new TreeMap<>();
        PlanetChildRouteDownload.Catalog downloads=new PlanetChildRouteDownload.Catalog();boolean sdkReading;final TreeMap<String,TreeMap<String,ReadingEntry>> reading=new TreeMap<>();boolean sdkPassport;final TreeMap<String,PassportEntry> passports=new TreeMap<>();boolean sdkJourney;final TreeMap<String,JourneyEntry> journeys=new TreeMap<>();boolean sdkAppearance;final TreeMap<String,AppearanceEntry> appearances=new TreeMap<>();boolean sdkCollections;String sdkUnboundBirth,sdkUnboundContent;final TreeMap<String,Long> collectionRevisions=new TreeMap<>(),tombstones=new TreeMap<>();
        void clearEntries(){for(Stored slot:entries.values())Arrays.fill(slot.value,(byte)0);}
        public void close(){clearEntries();for(PassportEntry entry:passports.values())entry.ledger.wipe();downloads.close();reading.clear();}
    }
    PlanetChildDataStore(Context context) throws Exception { this(context, null); }
    static PlanetChildDataStore synthetic(Context context, String runId) throws Exception {
        require(context != null && "ru.probpera.literaryplanet.dev".equals(context.getPackageName())
            && (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 && runId != null && runId.matches("[a-f0-9]{32}"));
        return new PlanetChildDataStore(context, runId);
    }
    private PlanetChildDataStore(Context input, String runId) throws Exception {this(input,runId,null);}
    private PlanetChildDataStore(Context input,String runId,PlanetChildVault.LocalV2SDKReadPermit recovery) throws Exception {
        require(input != null); context = input.getApplicationContext(); require(context != null
            && context.getPackageName().matches("ru\\.probpera\\.literaryplanet(?:\\.dev|\\.rustore)?"));
        name = "literary-planet-child-data-v1" + (runId == null ? "" : "-synthetic-" + runId);
        identity = context.getPackageName() + "." + name;
        locked(directory -> { if(runId==null){if(recovery!=null)recoverDownloadStaging(directory,recovery);require(!downloadRecovery(directory).exists());existingRecord(directory);knownBirth(directory);noPendingExceptDownload(directory);}else initialize(directory); return null; });
    }
    private static void require(boolean condition) throws Unavailable { if (!condition) throw new Unavailable(); }
    private static boolean identifier(String value) { return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"); }
    private static boolean checksum(String value) { return value != null && value.matches("[a-f0-9]{64}"); }
    private static boolean positive(long value) { return value >= 1 && value <= MAX_SAFE; }
    private static long integer(Object value, long min, long max) throws Exception {
        require(value instanceof Integer || value instanceof Long); long number = ((Number) value).longValue(); require(number >= min && number <= max); return number;
    }
    private static String text(Object value) throws Exception { require(value instanceof String); return (String) value; }
    private static String hex(byte[] bytes) { StringBuilder out = new StringBuilder(bytes.length * 2); for (byte b : bytes) out.append("0123456789abcdef".charAt((b & 255) >>> 4)).append("0123456789abcdef".charAt(b & 15)); return out.toString(); }
    private static String digest(byte[] value) throws Exception { byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value); try { return hex(bytes); } finally { Arrays.fill(bytes, (byte) 0); } }
    private static String nonce() { byte[] bytes = new byte[16]; RANDOM.nextBytes(bytes); try { return hex(bytes); } finally { Arrays.fill(bytes, (byte) 0); } }
    private static String utf8(byte[] bytes) throws Exception { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString(); }
    private static boolean entityKind(String kind) { return kind != null && Arrays.asList("country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","narration","image","animation","background","skin","stand","accessory","search-result","recommendation","favorite","recent","offline-package","deep-link","external-link","store-preview").contains(kind); }
    private static void exact(JSONObject object, String... keys) throws Exception {
        require(object.length() == keys.length); for (String key : keys) require(object.has(key));
    }
    private static String reference(JSONObject ref) throws Exception {
        exact(ref,"kind","id","contentChecksum"); String kind=text(ref.get("kind")),id=text(ref.get("id"));
        require(entityKind(kind) && identifier(id) && checksum(text(ref.get("contentChecksum")))); return kind+"/"+id;
    }
    private static void payload(JSONObject payload) throws Exception {
        if(payload.has("readingAnchors"))exact(payload,"title","text","terms","references","readingAnchors");else exact(payload,"title","text","terms","references");if(payload.has("readingAnchors"))PlanetChildReadingPosition.anchors(PlanetChildReadingPosition.storedJson(payload.get("readingAnchors")),text(payload.get("text"))); String title=text(payload.get("title")),body=text(payload.get("text"));
        require(!title.isEmpty() && title.length()<=240 && body.length()<=32768
            && !title.matches("(?s).*[\\x00-\\x1f\\x7f].*") && !body.matches("(?s).*[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f].*"));
        JSONArray terms=payload.getJSONArray("terms"),refs=payload.getJSONArray("references"); require(terms.length()<=64 && refs.length()<=64);
        Set<String> seen=new HashSet<>(); for(int i=0;i<terms.length();i++) { String term=text(terms.get(i)); require(!term.isEmpty() && term.length()<=80 && !term.matches("(?s).*[\\x00-\\x1f\\x7f].*") && seen.add(term)); }
        seen.clear(); for(int i=0;i<refs.length();i++) require(seen.add(reference(refs.getJSONObject(i))));
    }
    private static Scope objectScope(JSONObject object) throws Exception {
        exact(object,"schemaVersion","namespace","profileId","profileRevision","exactAge","locale","policyVersion","policyChecksum","packageId","packageVersion","packageChecksum");
        require(integer(object.get("schemaVersion"),1,1) == 1 && "child".equals(object.get("namespace")));
        return new Scope(text(object.get("profileId")),integer(object.get("profileRevision"),1,MAX_SAFE),(int) integer(object.get("exactAge"),3,17),text(object.get("locale")),
            text(object.get("policyVersion")),text(object.get("policyChecksum")),text(object.get("packageId")),integer(object.get("packageVersion"),1,MAX_SAFE),text(object.get("packageChecksum")));
    }
    private static Scope keyScope(Purpose purpose, String key) throws Exception {
        String prefix = "probpera-child-v1/" + purpose.name() + "/"; require(key != null && key.length() <= 4096 && key.startsWith(prefix));
        String remainder = key.substring(prefix.length()), encoded = remainder.split("/",-1)[0]; require(encoded.length() >= 2 && encoded.length() % 2 == 0 && encoded.matches("[a-f0-9]+"));
        byte[] tuple = new byte[encoded.length()/2]; for(int i=0;i<tuple.length;i++) tuple[i]=(byte) Integer.parseInt(encoded.substring(i*2,i*2+2),16);
        Scope scope; try { scope = Scope.decode(utf8(tuple)); } finally { Arrays.fill(tuple,(byte) 0); }
        if (purpose == Purpose.search || purpose == Purpose.history) require(key.equals(scope.key(purpose)));
        else { String[] item = remainder.substring(encoded.length()).split("/",-1); require(item.length == 4 && item[0].isEmpty() && "item".equals(item[1])); require(key.equals(scope.itemKey(purpose,item[2],item[3]))); }
        return scope;
    }
    /** Structural envelope only. The TS compiled index must still independently
     * validate payload semantics and current review before delivering content. */
    private static void envelope(Purpose purpose, String key, Scope scope, byte[] bytes) throws Exception {
        require(bytes.length > 0 && bytes.length <= MAX_VALUE_BYTES); String text = utf8(bytes); StrictJson.validate(text);
        JSONObject object = new JSONObject(text); exact(object,"schemaVersion","scope",purpose == Purpose.search || purpose == Purpose.history ? "references" : "entries");
        require(integer(object.get("schemaVersion"),1,1) == 1 && scope.tuple.equals(objectScope(object.getJSONObject("scope")).tuple));
        JSONArray rows = object.getJSONArray(purpose == Purpose.search || purpose == Purpose.history ? "references" : "entries"); require(rows.length() <= MAX_SLOTS);
        if (purpose == Purpose.search || purpose == Purpose.history) {
            Set<String> ids = new HashSet<>(); for(int i=0;i<rows.length();i++) { JSONObject reference = rows.getJSONObject(i); exact(reference,"kind","id","contentChecksum");
                String kind=text(reference.get("kind")),id=text(reference.get("id")); require((purpose == Purpose.search ? "search-result" : "recent").equals(kind) && identifier(id) && checksum(text(reference.get("contentChecksum"))) && ids.add(kind+"/"+id)); }
        } else {
            require(rows.length() > 0); Map<String,String> ids = new HashMap<>();
            for(int i=0;i<rows.length();i++) { JSONObject entry=rows.getJSONObject(i); exact(entry,"reference","payload"); JSONObject ref=entry.getJSONObject("reference"); exact(ref,"kind","id","contentChecksum");
                String kind=text(ref.get("kind")),id=text(ref.get("id")),reference=reference(ref); require(!ids.containsKey(reference)); ids.put(reference,text(ref.get("contentChecksum")));
                if(i==0) require(key.equals(scope.itemKey(purpose,kind,id))); payload(entry.getJSONObject("payload"));
            }
            for(int i=0;i<rows.length();i++) { JSONArray refs=rows.getJSONObject(i).getJSONObject("payload").getJSONArray("references");
                for(int j=0;j<refs.length();j++) { JSONObject ref=refs.getJSONObject(j); require(text(ref.get("contentChecksum")).equals(ids.get(reference(ref)))); } }
        }
    }
    private void unlocked() throws Exception { KeyguardManager manager=(KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE); require(manager != null && !manager.isDeviceLocked()); }
    private File directory() throws Exception {
        File parent=context.getNoBackupFilesDir().getCanonicalFile(), directory=new File(parent,name); require(directory.getAbsoluteFile().equals(directory.getCanonicalFile()));
        require(directory.isDirectory() || directory.mkdir()); require(directory.isDirectory() && directory.getCanonicalFile().getParentFile().equals(parent)); return directory;
    }
    private AtomicFile record(File directory) throws Exception {
        File file=new File(directory,"snapshot-v1"); for(String suffix:new String[]{"",".bak",".new"}) { File candidate=new File(file.getPath()+suffix); require(candidate.getAbsoluteFile().equals(candidate.getCanonicalFile()));
            if(candidate.exists()) { StructStat stat=Os.lstat(candidate.getPath()); require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size >= 0 && stat.st_size <= MAX_SNAPSHOT_BYTES+29); } }
        return new AtomicFile(file);
    }
    private SecretKey key(boolean create, File directory) throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null); String alias=identity+".aes";
        if(store.containsAlias(alias)) { require(!create); java.security.Key key=store.getKey(alias,null); require(key instanceof SecretKey && "AES".equals(key.getAlgorithm()) && key.getEncoded()==null);
            android.security.keystore.KeyInfo info=(android.security.keystore.KeyInfo)javax.crypto.SecretKeyFactory.getInstance("AES","AndroidKeyStore").getKeySpec((SecretKey)key,android.security.keystore.KeyInfo.class);
            require(info.getKeySize()==256 && info.getPurposes()==(KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                && info.getKeystoreAlias().equals(alias) && Arrays.equals(info.getBlockModes(),new String[]{KeyProperties.BLOCK_MODE_GCM})
                && Arrays.equals(info.getEncryptionPaddings(),new String[]{KeyProperties.ENCRYPTION_PADDING_NONE}));return (SecretKey)key; }
        AtomicFile record=record(directory); require(create && !record.getBaseFile().exists() && !new File(record.getBaseFile().getPath()+".bak").exists() && !new File(record.getBaseFile().getPath()+".new").exists());
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        KeyGenParameterSpec.Builder builder=new KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true);
        if(Build.VERSION.SDK_INT>=28) builder.setUnlockedDeviceRequired(true); generator.init(builder.build()); return generator.generateKey();
    }
    private void initialize(File directory) throws Exception {
        unlocked(); require(!birthMarker(directory).exists()); AtomicFile file=record(directory); KeyStore keys=KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        boolean exists=file.getBaseFile().exists() || new File(file.getBaseFile().getPath()+".bak").exists() || new File(file.getBaseFile().getPath()+".new").exists();
        if(exists || keys.containsAlias(identity+".aes")) { require(exists && keys.containsAlias(identity+".aes")); try(State ignored=read(directory)) {} return; }
        key(true,directory); State state=new State(); state.generation=0; state.nonce=nonce();
        try { write(directory,state,()->require(!closed)); } finally { state.close(); }
    }
    private static final class WipingBytes extends ByteArrayOutputStream {
        private void capacity(int extra) { if(extra<0 || count>MAX_SNAPSHOT_BYTES-extra) throw new IllegalArgumentException("bounded-child-snapshot");
            int required=count+extra; if(required>buf.length) { byte[] previous=buf; buf=Arrays.copyOf(previous,Math.min(MAX_SNAPSHOT_BYTES,Math.max(required,previous.length*2))); Arrays.fill(previous,(byte)0); } }
        @Override public synchronized void write(int value) { capacity(1); buf[count++]=(byte)value; }
        @Override public synchronized void write(byte[] value,int offset,int length) { capacity(length); System.arraycopy(value,offset,buf,count,length); count+=length; }
        @Override public void close() { Arrays.fill(buf,(byte)0); reset(); }
    }
    private static void validateSeals(State state) throws Exception {if(state.admissionBinding==null){require(state.seals.isEmpty()&&state.pendingMigration==null);return;}require((state.pendingMigration==null||checksum(state.pendingMigration))&&checksum(state.admissionBinding)&&state.seals.size()<=4);for(Map.Entry<String,Seal> item:state.seals.entrySet())require(item.getKey().equals(item.getValue().scope.profileId)&&checksum(item.getValue().contentBinding));if(state.scope!=null){Seal selected=state.seals.get(state.scope.profileId);require(selected!=null&&state.scope.tuple.equals(selected.scope.tuple));}for(String compound:state.entries.keySet()){int split=compound.indexOf('\n');Scope saved=keyScope(Purpose.valueOf(compound.substring(0,split)),compound.substring(split+1));Seal seal=state.seals.get(saved.profileId);require(seal!=null&&saved.tuple.equals(seal.scope.tuple));}}
    private static byte[] encode(State state) throws Exception {validateSeals(state);
        try(WipingBytes bytes=new WipingBytes()) { DataOutputStream out=new DataOutputStream(bytes);
        out.writeInt(0x4c504431); out.writeLong(state.generation); out.writeUTF(state.nonce); out.writeBoolean(state.scope!=null); if(state.scope!=null) out.writeUTF(state.scope.tuple);
        require(state.entries.size()<=MAX_SLOTS); out.writeInt(state.entries.size());
        for(Map.Entry<String,Stored> entry:state.entries.entrySet()) { String compound=entry.getKey(); int split=compound.indexOf('\n'); Purpose purpose=Purpose.valueOf(compound.substring(0,split)); String key=compound.substring(split+1);
            Stored stored=entry.getValue(); Scope scope=keyScope(purpose,key); envelope(purpose,key,scope,stored.value); require(positive(stored.revision) && stored.revision < MAX_SAFE);
            out.writeByte(purpose.ordinal()); out.writeUTF(key); out.writeLong(stored.revision); out.writeUTF(digest(stored.value)); out.writeInt(stored.value.length); out.write(stored.value);
            require(bytes.size()<=MAX_SNAPSHOT_BYTES); }
        if(state.admissionBinding!=null){out.writeInt(0x4c504133);out.writeUTF(state.admissionBinding);out.writeBoolean(state.pendingMigration!=null);if(state.pendingMigration!=null)out.writeUTF(state.pendingMigration);out.writeInt(state.seals.size());for(Seal seal:state.seals.values()){out.writeUTF(seal.scope.tuple);out.writeUTF(seal.contentBinding);}}
        encodeCollections(state,out);encodeAppearance(state,out);encodeJourney(state,out);encodePassport(state,out);encodeDownloads(state,out);encodeReading(state,out);out.flush(); byte[] result=bytes.toByteArray(); require(result.length<=MAX_SNAPSHOT_BYTES); return result; }
    }
    private static State decode(byte[] bytes) throws Exception {
        State state=new State(); boolean successful=false; try { DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes)); require(in.readInt()==0x4c504431);
            state.generation=in.readLong(); require(state.generation>=0 && state.generation<MAX_SAFE); state.nonce=in.readUTF(); require(state.nonce.matches("[a-f0-9]{32}"));
            int flag=in.readUnsignedByte(); require(flag==0 || flag==1); if(flag==1) state.scope=Scope.decode(in.readUTF()); int count=in.readInt(); require(count>=0 && count<=MAX_SLOTS);
            for(int i=0;i<count;i++) { int rawPurpose=in.readUnsignedByte(); require(rawPurpose<Purpose.values().length); Purpose purpose=Purpose.values()[rawPurpose]; String key=in.readUTF(); Scope scope=keyScope(purpose,key);
                long revision=in.readLong(); require(positive(revision) && revision < MAX_SAFE); String hash=in.readUTF(); require(checksum(hash)); int length=in.readInt(); require(length>0 && length<=MAX_VALUE_BYTES && length<=in.available());
                byte[] value=new byte[length]; boolean owned=false; try { in.readFully(value); require(digest(value).equals(hash)); envelope(purpose,key,scope,value);
                    require(!state.entries.containsKey(purpose.name()+"\n"+key)); state.entries.put(purpose.name()+"\n"+key,new Stored(revision,value)); owned=true; } finally { if(!owned) Arrays.fill(value,(byte)0); } }
            if(in.available()>0){require(in.readInt()==0x4c504133);state.admissionBinding=in.readUTF();require(checksum(state.admissionBinding));int pending=in.readUnsignedByte();require(pending==0||pending==1);if(pending==1){state.pendingMigration=in.readUTF();require(checksum(state.pendingMigration));}int seals=in.readInt();require(seals>=0&&seals<=4);for(int i=0;i<seals;i++){Scope saved=Scope.decode(in.readUTF());String content=in.readUTF();require(checksum(content)&&!state.seals.containsKey(saved.profileId));state.seals.put(saved.profileId,new Seal(saved,content));}}if(in.available()>0)decodeCollections(state,in);if(in.available()>0)decodeAppearance(state,in);if(in.available()>0)decodeJourney(state,in);if(in.available()>0)decodePassport(state,in);if(in.available()>0)decodeDownloads(state,in);if(in.available()>0)decodeReading(state,in);validateReading(state);validateDownloads(state);validatePassport(state);validateSeals(state);validateCollections(state);validateAppearance(state);validateJourney(state);
            require(in.available()==0); successful=true; return state;
        } finally { if(!successful) state.close(); }
    }
    private State read(File directory) throws Exception {
        unlocked(); AtomicFile file=record(directory); require(file.getBaseFile().exists() || new File(file.getBaseFile().getPath()+".bak").exists()); byte[] encoded=file.readFully(),plain=null;
        try { require(encoded.length>=30 && encoded.length<=MAX_SNAPSHOT_BYTES+29 && encoded[0]==1); Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(false,directory),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13))); cipher.updateAAD(identity.getBytes(StandardCharsets.UTF_8)); plain=cipher.doFinal(encoded,13,encoded.length-13);
            require(plain.length>0 && plain.length<=MAX_SNAPSHOT_BYTES); State state=decode(plain); try { unlocked(); return state; } catch(Exception failure) { state.close(); throw failure; }
        } finally { Arrays.fill(encoded,(byte)0); if(plain!=null) Arrays.fill(plain,(byte)0); }
    }
    private interface Check { void check() throws Exception; }
    private void write(File directory, State state, Check check) throws Exception {
        byte[] plain=encode(state),encoded=null,ciphertext=null; try { unlocked(); Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key(false,directory));
            byte[] iv=cipher.getIV(); require(iv!=null && iv.length==12); cipher.updateAAD(identity.getBytes(StandardCharsets.UTF_8)); ciphertext=cipher.doFinal(plain); encoded=ByteBuffer.allocate(13+ciphertext.length).put((byte)1).put(iv).put(ciphertext).array();
            AtomicFile file=record(directory); FileOutputStream output=null; check.check();
            try { output=file.startWrite(); for(int position=0;position<encoded.length;position+=65536) { check.check(); output.write(encoded,position,Math.min(65536,encoded.length-position)); }
                output.getFD().sync(); check.check(); file.finishWrite(output); output=null; }
            finally { if(output!=null) file.failWrite(output); }
            FileDescriptor descriptor=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_CLOEXEC,0); try { require(OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)); Os.fsync(descriptor); } finally { Os.close(descriptor); }
            require(!new File(file.getBaseFile().getPath()+".bak").exists()&&!new File(file.getBaseFile().getPath()+".new").exists());
            try(State actual=read(directory)) { byte[] readback=encode(actual); try { require(MessageDigest.isEqual(plain,readback)); } finally { Arrays.fill(readback,(byte)0); } }
            check.check(); // Post-publication failure is unknown ack, never rollback.
        } finally { Arrays.fill(plain,(byte)0); if(encoded!=null) Arrays.fill(encoded,(byte)0); if(ciphertext!=null) Arrays.fill(ciphertext,(byte)0); }
    }
    private interface Work<T> { T run(File directory) throws Exception; }
    private <T> T locked(Work<T> work) throws Exception {
        boolean acquired=false; long start=SystemClock.elapsedRealtime(); try { acquired=PROCESS_LOCK.tryLock(1500,TimeUnit.MILLISECONDS); require(acquired);
            File directory=directory(),file=new File(directory,"transaction.lock"); require(file.getAbsoluteFile().equals(file.getCanonicalFile()));
            FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_RDWR|OsConstants.O_CREAT|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
            try(FileOutputStream owner=new FileOutputStream(fd)) { FileLock lock=null; try { while(lock==null) { try { lock=owner.getChannel().tryLock(); } catch(OverlappingFileLockException busy) {}
                    long now=SystemClock.elapsedRealtime(); require(!Thread.currentThread().isInterrupted() && now>=start && now-start<1500); if(lock==null) Thread.sleep(10); }
                StructStat opened=Os.fstat(fd),named=Os.lstat(file.getPath()); require(OsConstants.S_ISREG(opened.st_mode) && opened.st_ino==named.st_ino && opened.st_dev==named.st_dev); return work.run(directory);
            } finally { if(lock!=null) lock.release(); } }
        } catch(InterruptedException failure) { Thread.currentThread().interrupt(); throw new Unavailable(); } catch(Exception failure) { throw new Unavailable(); } finally { if(acquired) PROCESS_LOCK.unlock(); }
    }
    private void live(Lease lease, State state) throws Exception { require(!closed && active==lease && lease!=null && lease.admission==null && lease.owner==this && state.scope!=null
        && state.generation==lease.generation && state.nonce.equals(lease.nonce) && state.scope.tuple.equals(lease.scope.tuple)); }
    Lease activate(Scope scope) throws Exception {
        require(scope!=null); return locked(directory->{ require(!closed); active=null; try(State state=read(directory)) {
            require(state.admissionBinding==null&&state.seals.isEmpty());require(state.generation<MAX_SAFE-1); state.generation++; state.nonce=nonce(); state.scope=scope;
            write(directory,state,()->require(!closed)); Lease lease=new Lease(this,scope,state.generation,state.nonce); active=lease; return lease; } });
    }
    Cancellation operation(Lease lease, long timeoutMs) throws Exception {
        require(timeoutMs>0 && timeoutMs<=60000); return locked(directory->{ try(State state=read(directory)) { live(lease,state); long now=SystemClock.elapsedRealtime(); require(now>=0 && now<=MAX_SAFE-timeoutMs); return new Cancellation(this,lease,now+timeoutMs); } });
    }
    // Native continuous operation budget only; never trusted review/PIN time.
    Cancellation operationUntil(Lease lease, long deadlineMs) throws Exception {
        require(deadlineMs > 0 && deadlineMs <= MAX_SAFE);
        return locked(directory -> { try (State state = read(directory)) {
            live(lease,state); long now = SystemClock.elapsedRealtime();
            require(now >= 0 && now < deadlineMs && deadlineMs - now <= 60000);
            return new Cancellation(this,lease,deadlineMs);
        } });
    }
    void cancel(Cancellation cancellation) throws Exception { require(cancellation!=null && cancellation.owner==this); locked(directory->{ cancellation.cancelled=true; return null; }); }
    private void check(Cancellation cancellation, Lease lease, State state) throws Exception { live(lease,state); require(cancellation.owner==this && cancellation.lease==lease && cancellation.used && !cancellation.cancelled
        && !Thread.currentThread().isInterrupted() && SystemClock.elapsedRealtime()<cancellation.deadline); unlocked(); }
    Result transact(Lease lease, List<ReadKey> reads, List<Mutation> writes, Cancellation cancellation) throws Exception {
        require(reads!=null && writes!=null && reads.size()<=MAX_BATCH && writes.size()<=MAX_BATCH && cancellation!=null);
        List<ReadKey> ownedReads=new ArrayList<>(reads); List<Mutation> ownedWrites=new ArrayList<>(writes);
        require(ownedReads.size()<=MAX_BATCH && ownedWrites.size()<=MAX_BATCH);
        List<byte[]> values=new ArrayList<>(ownedWrites.size());
        try { int copiedBytes=0; for(Mutation mutation:ownedWrites) { require(mutation!=null); byte[] owned=mutation.copy(MAX_SNAPSHOT_BYTES-copiedBytes); values.add(owned); copiedBytes+=owned.length; }
            return locked(directory->{ try(State state=read(directory)) { require(!cancellation.used); cancellation.used=true; check(cancellation,lease,state);
                Set<String> readIds=new HashSet<>(),writeIds=new HashSet<>(); Map<String,Slot> result=new LinkedHashMap<>(); boolean handed=false;
                try { for(ReadKey read:ownedReads) { require(read!=null && keyScope(read.purpose,read.key).tuple.equals(lease.scope.tuple)); String id=read.purpose.name()+"\n"+read.key; require(readIds.add(id)); }
                    for(int i=0;i<ownedWrites.size();i++) { Mutation mutation=ownedWrites.get(i); require(keyScope(mutation.purpose,mutation.key).tuple.equals(lease.scope.tuple)); String id=mutation.purpose.name()+"\n"+mutation.key;
                        require(writeIds.add(id)); Stored previous=state.entries.get(id); require((previous==null?0:previous.revision)==mutation.expectedRevision); envelope(mutation.purpose,mutation.key,lease.scope,values.get(i)); }
                    // Every mutation is validated before any state is changed.
                    for(ReadKey read:ownedReads) { String id=read.purpose.name()+"\n"+read.key; Stored previous=state.entries.get(id); result.put(id,new Slot(previous==null?0:previous.revision,previous==null?null:previous.value)); }
                    for(int i=0;i<ownedWrites.size();i++) { Mutation mutation=ownedWrites.get(i); String id=mutation.purpose.name()+"\n"+mutation.key; Stored replaced=state.entries.put(id,new Stored(mutation.expectedRevision+1,values.get(i).clone())); if(replaced!=null) Arrays.fill(replaced.value,(byte)0); }
                    check(cancellation,lease,state); if(!ownedWrites.isEmpty()) write(directory,state,()->check(cancellation,lease,state)); check(cancellation,lease,state);
                    Result answer=new Result(result); handed=true; return answer;
                } finally { if(!handed) for(Slot slot:result.values()) slot.close(); }
            } });
        } finally { for(byte[] value:values) Arrays.fill(value,(byte)0); }
    }
    void retire(Lease lease) throws Exception { locked(directory->{ try(State state=read(directory)) { live(lease,state); active=null; require(state.generation<MAX_SAFE-1); state.generation++; state.nonce=nonce(); state.scope=null; write(directory,state,()->require(!closed)); return null; } }); }
    void close() throws Exception { locked(directory->{ Lease lease=active; active=null; closed=true; if(lease!=null&&lease.admission!=null)existingOnly(directory); if(lease!=null) try(State state=read(directory)) {
        if(state.scope!=null && state.generation==lease.generation && state.nonce.equals(lease.nonce)) { require(state.generation<MAX_SAFE-1); state.generation++; state.nonce=nonce(); state.scope=null; write(directory,state,()->{}); } } return null; }); }

    /** Vault flock is already held. Admission.check rereads that same opened
     * canonical record without reacquiring it; this fixed Vault -> DataStore
     * order is also used for migration/readback. No main/UI joins occur here. */
    private void admittedState(PlanetChildVault.LocalV2DataAdmission admission,State state) throws Exception {
        admission.check();require(state.admissionBinding!=null&&state.admissionBinding.equals(admission.binding()));admission.futureSeals(sealBindings(state));Scope scope=admission.scope();
        if(scope==null)require(state.scope==null);else{Seal seal=state.seals.get(scope.profileId);require(seal!=null&&seal.contentBinding.equals(admission.contentBinding())&&seal.scope.tuple.equals(scope.tuple));}if(state.pendingMigration!=null)require(state.pendingMigration.equals(admission.migrationIdentity()));
    }
    private static Map<String,String> sealBindings(State state){Map<String,String> result=new TreeMap<>();if(state.sdkUnboundBirth!=null){result.put(state.sdkUnboundBirth,state.sdkUnboundContent);return result;}for(Map.Entry<String,Seal> entry:state.seals.entrySet())result.put(entry.getKey(),entry.getValue().contentBinding);return result;}
    private void admittedLive(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,State state) throws Exception {
        admittedState(admission,state);require(state.pendingMigration==null&&!closed&&active==lease&&lease!=null&&lease.owner==this&&lease.admission==admission&&state.scope!=null
            &&state.generation==lease.generation&&state.nonce.equals(lease.nonce)&&state.scope.tuple.equals(lease.scope.tuple));
    }
    Lease admit(PlanetChildVault.LocalV2DataAdmission admission) throws Exception {require(admission!=null);return locked(directory->{admission.check();existingOnly(directory);require(!closed&&active==null);try(State state=read(directory)){
        require(state.scope==null&&state.pendingMigration==null);PlanetChildVault.LocalV2KnownBirth birth=knownBirth(directory);admission.retainedBirth(birth);Scope current=admission.scope();require(current!=null);
        if(state.admissionBinding==null){require(admission.initialProfile()&&state.seals.isEmpty()&&state.generation==0&&state.entries.isEmpty()&&state.nonce.equals(birth.nonce));byte[] empty=encode(state);try{require(digest(empty).equals(birth.emptyChecksum));}finally{Arrays.fill(empty,(byte)0);}state.admissionBinding=admission.binding();state.seals.put(current.profileId,new Seal(current,admission.contentBinding()));}
        else {require(state.admissionBinding.equals(admission.binding()));if(state.sdkUnboundBirth!=null){require(current.profileId.equals(state.sdkUnboundBirth)&&current.profileId.equals(birth.profileId)&&birth.contentBinding.equals(state.sdkUnboundContent)&&birth.contentBinding.equals(admission.contentBinding()));admission.futureSeals(sealBindings(state));state.seals.put(current.profileId,new Seal(current,admission.contentBinding()));state.sdkUnboundBirth=null;state.sdkUnboundContent=null;}else require(state.seals.containsKey(current.profileId));}admittedState(admission,state);
        for(Map.Entry<String,Stored> entry:state.entries.entrySet()){int split=entry.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(entry.getKey().substring(0,split));String key=entry.getKey().substring(split+1);if(keyScope(purpose,key).profileId.equals(current.profileId))admission.validate(purpose,key,entry.getValue().value);}
        require(state.generation<MAX_SAFE-1);state.generation++;state.nonce=nonce();state.scope=current;write(directory,state,admission::check);admittedState(admission,state);
        Lease lease=new Lease(this,state.scope,state.generation,state.nonce,admission);active=lease;return lease;
    }});}
    Cancellation admittedOperation(PlanetChildVault.LocalV2DataAdmission admission,Lease lease) throws Exception {return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){
        admittedLive(admission,lease,state);long now=SystemClock.elapsedRealtime(),deadline=admission.deadline();require(now>=0&&now<deadline&&deadline-now<=60000);return new Cancellation(this,lease,deadline);
    }});}
    Slot admittedQuery(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Result original,Purpose purpose,String key) throws Exception {return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);require(keyScope(purpose,key).tuple.equals(lease.scope.tuple));Slot captured=original.get(purpose,key);require(captured!=null);String compound=purpose.name()+"\n"+key;Stored saved=state.entries.get(compound);require(captured.revision==(saved==null?state.tombstones.getOrDefault(compound,0L):saved.revision)&&Objects.equals(captured.checksum,saved==null?null:digest(saved.value)));if(saved!=null)admission.validate(purpose,key,saved.value);Slot copied=new Slot(saved==null?state.tombstones.getOrDefault(compound,0L):saved.revision,saved==null?null:saved.value);try{admission.check();return copied;}catch(Exception failure){copied.close();throw failure;}}});}
    private void admittedCheck(PlanetChildVault.LocalV2DataAdmission admission,Cancellation cancellation,Lease lease,State state) throws Exception {admittedLive(admission,lease,state);require(cancellation.owner==this&&cancellation.lease==lease&&cancellation.used&&!cancellation.cancelled&&!Thread.currentThread().isInterrupted()&&SystemClock.elapsedRealtime()<cancellation.deadline&&cancellation.deadline==admission.deadline());unlocked();}
    Result admittedTransact(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,List<ReadKey> reads,List<Mutation> writes,Cancellation cancellation) throws Exception {
        require(admission!=null&&reads!=null&&writes!=null&&reads.size()<=MAX_BATCH&&writes.size()<=MAX_BATCH&&cancellation!=null);List<ReadKey> ownedReads=new ArrayList<>(reads);List<Mutation> ownedWrites=new ArrayList<>(writes);List<byte[]> values=new ArrayList<>();
        try{int size=0;for(Mutation write:ownedWrites){require(write!=null);byte[] bytes=write.copy(MAX_SNAPSHOT_BYTES-size);values.add(bytes);size+=bytes.length;}
            return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){require(!cancellation.used);cancellation.used=true;admittedCheck(admission,cancellation,lease,state);Set<String> readIds=new HashSet<>(),writeIds=new HashSet<>();Map<String,Slot> result=new LinkedHashMap<>();boolean handed=false;
                try{for(ReadKey read:ownedReads){require(read!=null&&keyScope(read.purpose,read.key).tuple.equals(lease.scope.tuple));String id=read.purpose.name()+"\n"+read.key;require(readIds.add(id));Stored saved=state.entries.get(id);if(saved!=null)admission.validate(read.purpose,read.key,saved.value);}
                    for(int i=0;i<ownedWrites.size();i++){Mutation write=ownedWrites.get(i);require(keyScope(write.purpose,write.key).tuple.equals(lease.scope.tuple));String id=write.purpose.name()+"\n"+write.key;require(writeIds.add(id));Stored old=state.entries.get(id);require((old==null?state.tombstones.getOrDefault(id,0L):old.revision)==write.expectedRevision);envelope(write.purpose,write.key,lease.scope,values.get(i));admission.validate(write.purpose,write.key,values.get(i));}
                    for(ReadKey read:ownedReads){String id=read.purpose.name()+"\n"+read.key;Stored saved=state.entries.get(id);result.put(id,new Slot(saved==null?state.tombstones.getOrDefault(id,0L):saved.revision,saved==null?null:saved.value));}
                    for(int i=0;i<ownedWrites.size();i++){Mutation write=ownedWrites.get(i);String id=write.purpose.name()+"\n"+write.key;state.tombstones.remove(id);Stored replaced=state.entries.put(id,new Stored(write.expectedRevision+1,values.get(i).clone()));if(replaced!=null)Arrays.fill(replaced.value,(byte)0);}
                    admittedCheck(admission,cancellation,lease,state);if(!ownedWrites.isEmpty())write(directory,state,()->admittedCheck(admission,cancellation,lease,state));admittedCheck(admission,cancellation,lease,state);
                    // Actual decrypted readback, including every newly committed
                    // purpose, remains under both original locks and deadline.
                    try(State actual=read(directory)){admittedLive(admission,lease,actual);for(int i=0;i<ownedWrites.size();i++){Mutation write=ownedWrites.get(i);Stored saved=actual.entries.get(write.purpose.name()+"\n"+write.key);require(saved!=null&&saved.revision==write.expectedRevision+1&&MessageDigest.isEqual(saved.value,values.get(i)));admission.validate(write.purpose,write.key,saved.value);}}
                    admittedCheck(admission,cancellation,lease,state);Result answer=new Result(result);handed=true;return answer;
                }finally{if(!handed)for(Slot slot:result.values())slot.close();}
            }});
        }finally{for(byte[] value:values)Arrays.fill(value,(byte)0);}
    }
    /** Actual old active namespace must have been durably retired. A partial
     * future data publication carries a different persistent binding and
     * cannot be reopened/adopted by the old profile. No repair/reset exists. */
    void migrate(PlanetChildVault.LocalV2DataAdmission admission) throws Exception {locked(directory->{admission.check();existingOnly(directory);require(!closed&&active==null);try(State state=read(directory)){
        require(state.scope==null&&state.pendingMigration==null);PlanetChildVault.LocalV2KnownBirth birth=knownBirth(directory);admission.retainedBirth(birth);Scope future=admission.scope();
        if(state.admissionBinding==null){require(future==null&&!admission.createsProfile());Map<String,String> prior=Collections.singletonMap(birth.profileId,birth.contentBinding);admission.previousSeals(prior);knownUnboundOrigin(state,birth.profileId,birth.nonce,birth.contentBinding,birth.emptyChecksum,prior);state.sdkCollections=true;state.sdkUnboundBirth=birth.profileId;state.sdkUnboundContent=birth.contentBinding;state.admissionBinding=admission.previousBinding();}
        require(state.admissionBinding.equals(admission.previousBinding()));admission.previousSeals(sealBindings(state));String deletionProfile=admission.deletionProfile();if(deletionProfile!=null)removeOwnedState(state,deletionProfile,admission.deletionScope());
        if(future!=null){Seal previous=state.seals.get(future.profileId);if(admission.createsProfile())require(state.sdkUnboundBirth==null&&previous==null&&state.seals.size()<4);else if(state.sdkUnboundBirth!=null)require(future.profileId.equals(state.sdkUnboundBirth)&&state.sdkUnboundContent.equals(admission.previousContentBinding()));else require(previous!=null&&previous.contentBinding.equals(admission.previousContentBinding()));}
        TreeMap<String,Stored> next=new TreeMap<>();boolean adopted=false;try{for(Map.Entry<String,Stored> entry:state.entries.entrySet()){admission.check();int split=entry.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(entry.getKey().substring(0,split));String oldKey=entry.getKey().substring(split+1);Scope oldScope=keyScope(purpose,oldKey);Seal oldSeal=state.seals.get(oldScope.profileId);require(oldSeal!=null&&oldScope.tuple.equals(oldSeal.scope.tuple));try(PlanetChildVault.LocalV2MigrationValue value=future==null?null:admission.partition(purpose,oldKey,entry.getValue().value)){if(future==null){require(!next.containsKey(entry.getKey()));next.put(entry.getKey(),new Stored(entry.getValue().revision,entry.getValue().value.clone()));continue;}if(value==null)continue;Scope nextScope=value.changed?future:oldScope;envelope(purpose,value.key,nextScope,value.bytes);if(value.changed)admission.validate(purpose,value.key,value.bytes);long revision=entry.getValue().revision;require(!value.changed||revision<MAX_SAFE-1);String id=purpose.name()+"\n"+value.key;require(!next.containsKey(id));next.put(id,new Stored(revision+(value.changed?1:0),value.bytes.clone()));}}
            if(future!=null){state.seals.put(future.profileId,new Seal(future,admission.contentBinding()));state.sdkUnboundBirth=null;state.sdkUnboundContent=null;}migrateTombstones(state,future);migrateAppearance(state);migrateJourney(state);migratePassport(state);migrateReading(state);require(state.generation<MAX_SAFE-1);state.generation++;state.nonce=nonce();state.admissionBinding=admission.binding();state.pendingMigration=admission.migrationIdentity();state.clearEntries();state.entries.clear();state.entries.putAll(next);adopted=true;
            admission.markDataWrite();pendingMigrationFile(directory,state.pendingMigration);if(deletionProfile!=null&&"profile".equals(admission.deletionScope()))redactBirth(directory,admission,deletionProfile);write(directory,state,admission::check);admission.commitCanonical();admittedState(admission,state);cleanupDownloadObjects(directory,state,deletionProfile,admission::check);return null;
        }finally{if(!adopted)for(Stored slot:next.values())Arrays.fill(slot.value,(byte)0);}
    }});}
    void migrationReadback(PlanetChildVault.LocalV2DataAdmission admission) throws Exception {locked(directory->{admission.check();existingMigration(directory,admission);try(State state=read(directory)){
        require(!closed&&active==null&&state.scope==null&&admission.migrationIdentity().equals(state.pendingMigration));admittedState(admission,state);
        for(Map.Entry<String,Stored> entry:state.entries.entrySet()){int split=entry.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(entry.getKey().substring(0,split));String key=entry.getKey().substring(split+1);Scope future=admission.scope();if(future!=null&&keyScope(purpose,key).profileId.equals(future.profileId))admission.validate(purpose,key,entry.getValue().value);}
        admission.acknowledgeCanonical();admission.check();return null;}});}
    /** The deny marker covers terminal publication and readback after joins. */
    void migrationComplete(PlanetChildVault.LocalV2DataAdmission admission) throws Exception {locked(directory->{admission.completionBoundary();existingMigration(directory,admission);String pending=admission.migrationIdentity();
        try(State state=read(directory)){require(!closed&&active==null&&state.scope==null&&pending.equals(state.pendingMigration));admittedState(admission,state);
            try{state.pendingMigration=null;write(directory,state,admission::completionBoundary);admittedState(admission,state);admission.completionBoundary();
                Os.remove(migrationPending(directory).getPath());syncBirthDirectory(directory);closed=true;return null;
            }catch(Throwable failure){try{pendingMigrationFile(directory,pending);}catch(Throwable sticky){failure.addSuppressed(sticky);}throw failure;}}
    });}

    /** Bounded strict JSON syntax with decoded-key duplicate detection. Android
     * JSONObject alone may silently overwrite duplicates; never use that as the
     * structural validator. No review/content authority derives from parsing. */
    private static final class StrictJson {
        final String input; int position,nodes; StrictJson(String input) { this.input=input; }
        static void validate(String input) throws Exception { StrictJson parser=new StrictJson(input); parser.value(0); parser.space(); require(parser.position==input.length()); }
        void space() { while(position<input.length() && " \t\r\n".indexOf(input.charAt(position))>=0) position++; }
        char take() throws Exception { require(position<input.length()); return input.charAt(position++); }
        void value(int depth) throws Exception { require(depth<=64 && ++nodes<=100000); space(); require(position<input.length()); char ch=input.charAt(position);
            if(ch=='{') { position++; space(); Set<String> keys=new HashSet<>(); if(position<input.length() && input.charAt(position)=='}') { position++; return; }
                while(true) { space(); String key=string(); require(keys.add(key)); space(); require(take()==':'); value(depth+1); space(); char separator=take(); if(separator=='}') return; require(separator==','); } }
            if(ch=='[') { position++; space(); if(position<input.length() && input.charAt(position)==']') { position++; return; }
                while(true) { value(depth+1); space(); char separator=take(); if(separator==']') return; require(separator==','); } }
            if(ch=='"') { string(); return; } for(String literal:new String[]{"true","false","null"}) if(input.startsWith(literal,position)) { position+=literal.length(); return; }
            int start=position; while(position<input.length() && "-+0123456789.eE".indexOf(input.charAt(position))>=0) position++; String number=input.substring(start,position);
            require(number.length()<=128 && number.matches("-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?")); double decoded=Double.parseDouble(number); require(!Double.isNaN(decoded) && !Double.isInfinite(decoded));
        }
        String string() throws Exception { require(take()=='"'); StringBuilder text=new StringBuilder(); while(true) { char ch=take(); if(ch=='"') break; require(ch>=32);
            if(ch=='\\') { char escape=take(); if(escape=='u') { require(position+4<=input.length()); String code=input.substring(position,position+4); require(code.matches("[a-fA-F0-9]{4}")); ch=(char)Integer.parseInt(code,16); position+=4; }
                else { int index="\"\\/bfnrt".indexOf(escape); require(index>=0); ch="\"\\/\b\f\n\r\t".charAt(index); } }
            text.append(ch); }
            for(int i=0;i<text.length();i++) { char ch=text.charAt(i); if(Character.isHighSurrogate(ch)) { require(i+1<text.length() && Character.isLowSurrogate(text.charAt(++i))); } else require(!Character.isLowSurrogate(ch)); }
            return text.toString();
        }
    }
    /** Explicit separate-key birth plan; metadata alone grants no admission. */
    static final class LocalV2BirthPlan implements AutoCloseable {
        final String identity,nonce,checksum;private final PlanetChildDataStore store;private final byte[] plain;
        private boolean used,closed;
        private LocalV2BirthPlan(PlanetChildDataStore store,String nonce) throws Exception {
            require(store!=null&&nonce!=null&&nonce.matches("[a-f0-9]{32}"));this.store=store;identity=store.identity;this.nonce=nonce;
            State state=new State();state.nonce=nonce;try{plain=encode(state);checksum=digest(plain);}finally{state.close();}
        }
        public synchronized void close(){closed=true;Arrays.fill(plain,(byte)0);}
    }
    static final class LocalV2BirthReceipt {
        private final LocalV2BirthPlan original;private final byte[] marker;private final String checksum;
        private LocalV2BirthReceipt(LocalV2BirthPlan original,byte[] marker){this.original=original;this.marker=marker.clone();checksum=original.checksum;}
        void retainUnknownCompletion() throws Exception {original.store.locked(directory->{File file=original.store.knownPending(directory);if(!file.exists())original.store.pendingBirth(directory,original.checksum.getBytes(StandardCharsets.US_ASCII));return null;});}
        void complete(PlanetChildVault.LocalV2ProfileBirthPermit permit) throws Exception {require(permit!=null);original.store.locked(directory->{byte[] plain=permit.dataKnownReceipt();try{original.store.exactBirth(directory,original,marker);original.store.completeBirth(directory,plain,permit);return null;}catch(Throwable failure){permit.dataBirthUnknown();throw failure;}finally{Arrays.fill(plain,(byte)0);}});}
        void readback(PlanetChildVault.LocalV2ProfileBirthPermit permit) throws Exception {
            require(permit!=null);original.store.locked(directory->{permit.dataReadback(original.identity,original.nonce,checksum);original.store.exactBirth(directory,original,marker);return null;});
        }
    }
    static LocalV2BirthPlan localV2BirthPlan(Context context,String nonce) throws Exception {
        return new LocalV2BirthPlan(new PlanetChildDataStore(context,null,true),nonce);
    }
    static LocalV2BirthPlan fixtureLocalV2BirthPlan(Context context,String runId,String nonce) throws Exception {
        require(context!=null&&"ru.probpera.literaryplanet.dev".equals(context.getPackageName())&&(context.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0
            &&runId!=null&&runId.matches("[a-f0-9]{32}"));return new LocalV2BirthPlan(new PlanetChildDataStore(context,runId,true),nonce);
    }
    static PlanetChildDataStore fixtureLocalV2ExistingOnly(Context context,String runId) throws Exception {
        try(LocalV2BirthPlan plan=fixtureLocalV2BirthPlan(context,runId,runId)){plan.store.locked(directory->{plan.store.existingOnly(directory);return null;});return plan.store;}
    }
    private PlanetChildDataStore(Context input,String runId,boolean deferredBirth) throws Exception {
        require(deferredBirth&&input!=null);context=input.getApplicationContext();require(context!=null&&context.getPackageName().matches("ru\\.probpera\\.literaryplanet(?:\\.dev|\\.rustore)?"));
        require(runId==null||"ru.probpera.literaryplanet.dev".equals(context.getPackageName())&&(context.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0&&runId.matches("[a-f0-9]{32}"));
        name="literary-planet-child-data-v1"+(runId==null?"":"-synthetic-"+runId);identity=context.getPackageName()+"."+name;
    }
    private void noPendingOperations(File directory) throws Exception {require(!knownPending(directory).exists()&&!migrationPending(directory).exists()&&!collectionPending(directory).exists()&&!appearancePending(directory).exists()&&!journeyPending(directory).exists()&&!passportPending(directory).exists()&&!readingPending(directory).exists());}
    private void existingOnly(File directory) throws Exception {existingRecord(directory);noPendingOperations(directory);knownBirth(directory);}
    private File migrationPending(File directory) throws Exception {File file=new File(directory,"local-v2-migration.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void pendingMigrationFile(File directory,String identity) throws Exception {
        require(identity!=null&&identity.matches("[a-f0-9]{64}"));File file=migrationPending(directory);byte[] marker=identity.getBytes(StandardCharsets.US_ASCII);
        try{if(file.exists()){byte[] actual=boundedRegular(file,64);try{require(MessageDigest.isEqual(actual,marker));}finally{Arrays.fill(actual,(byte)0);}return;}
            FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
            try{int at=0;while(at<marker.length){int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);
        }finally{Arrays.fill(marker,(byte)0);}
    }
    private void existingMigration(File directory,PlanetChildVault.LocalV2DataAdmission admission) throws Exception {
        existingRecord(directory);require(!knownPending(directory).exists()&&!collectionPending(directory).exists()&&!appearancePending(directory).exists()&&!journeyPending(directory).exists()&&!passportPending(directory).exists());knownBirth(directory);byte[] actual=boundedRegular(migrationPending(directory),64);
        try{require(new String(actual,StandardCharsets.US_ASCII).equals(admission.migrationIdentity()));}finally{Arrays.fill(actual,(byte)0);}
    }
    private void existingRecord(File directory) throws Exception {
        unlocked();AtomicFile file=record(directory);require(file.getBaseFile().isFile()&&!new File(file.getBaseFile().getPath()+".bak").exists()&&!new File(file.getBaseFile().getPath()+".new").exists());
        key(false,directory);try(State ignored=read(directory)){}
    }
    /** Known terminal is an independently encrypted receipt. An earlier claim
     * alone is never existing state; no optional ignore/bypass path exists. */
    private File knownPending(File directory) throws Exception {File file=new File(directory,"local-v2-birth.known.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void pendingBirth(File directory,byte[] identity) throws Exception {File file=knownPending(directory);if(file.exists()){byte[] actual=boundedRegular(file,4096);try{require(MessageDigest.isEqual(actual,identity));}finally{Arrays.fill(actual,(byte)0);}return;}
        FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);try{int at=0;while(at<identity.length){int n=Os.write(fd,identity,at,identity.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);}
    private void syncBirthDirectory(File directory) throws Exception {FileDescriptor fd=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);try{Os.fsync(fd);}finally{Os.close(fd);}}
    private AtomicFile knownRecord(File directory) throws Exception {
        File file=new File(directory,"local-v2-birth.known");for(String suffix:new String[]{"",".bak",".new"}){File named=new File(file.getPath()+suffix);require(named.getAbsoluteFile().equals(named.getCanonicalFile()));if(named.exists()){StructStat stat=Os.lstat(named.getPath());require(suffix.isEmpty()&&OsConstants.S_ISREG(stat.st_mode)&&stat.st_size>=30&&stat.st_size<=262144+29);}}return new AtomicFile(file);
    }
    private byte[] boundedRegular(File file,int max) throws Exception {
        require(file.getAbsoluteFile().equals(file.getCanonicalFile()));FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);byte[] bytes=null;boolean handed=false;
        try{StructStat opened=Os.fstat(fd),named=Os.lstat(file.getPath());require(OsConstants.S_ISREG(opened.st_mode)&&opened.st_dev==named.st_dev&&opened.st_ino==named.st_ino&&opened.st_size>0&&opened.st_size<=max);bytes=new byte[(int)opened.st_size];
            int at=0;while(at<bytes.length){int n=Os.read(fd,bytes,at,bytes.length-at);require(n>0);at+=n;}byte[] extra=new byte[1];require(Os.read(fd,extra,0,1)==0);handed=true;return bytes;
        }finally{Os.close(fd);if(!handed&&bytes!=null)Arrays.fill(bytes,(byte)0);}
    }
    private byte[] knownPlain(File directory) throws Exception {
        AtomicFile file=knownRecord(directory);require(file.getBaseFile().isFile());byte[] encoded=boundedRegular(file.getBaseFile(),262144+29),plain=null;
        try{require(encoded.length>=30&&encoded[0]==1);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(false,directory),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13)));
            cipher.updateAAD((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").getBytes(StandardCharsets.US_ASCII));plain=cipher.doFinal(encoded,13,encoded.length-13);require(plain.length>0&&plain.length<=262144);byte[] answer=plain;plain=null;return answer;
        }finally{Arrays.fill(encoded,(byte)0);if(plain!=null)Arrays.fill(plain,(byte)0);}
    }
    private PlanetChildVault.LocalV2KnownBirth knownBirth(File directory) throws Exception {
        byte[] plain=knownPlain(directory),claim=null;try{PlanetChildVault.LocalV2KnownBirth proof=PlanetChildVault.LocalV2KnownBirth.verify(context,identity,plain);claim=boundedRegular(birthMarker(directory),4096);require(digest(claim).equals(proof.claimChecksum));return proof;}
        finally{Arrays.fill(plain,(byte)0);if(claim!=null)Arrays.fill(claim,(byte)0);}
    }
    private void completeBirth(File directory,byte[] plain,PlanetChildVault.LocalV2ProfileBirthPermit permit) throws Exception {
        permit.dataCompletionBoundary();AtomicFile file=knownRecord(directory);require(!file.getBaseFile().exists()&&!knownPending(directory).exists());byte[] pending=digest(plain).getBytes(StandardCharsets.US_ASCII),encoded=null,ciphertext=null;FileOutputStream output=null;boolean began=false;
        try{PlanetChildVault.LocalV2KnownBirth.verify(context,identity,plain);pendingBirth(directory,pending);began=true;permit.dataCompletionBoundary();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(false,directory));byte[] iv=cipher.getIV();require(iv!=null&&iv.length==12);
            cipher.updateAAD((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").getBytes(StandardCharsets.US_ASCII));ciphertext=cipher.doFinal(plain);encoded=ByteBuffer.allocate(13+ciphertext.length).put((byte)1).put(iv).put(ciphertext).array();permit.dataCompletionBoundary();
            output=file.startWrite();for(int at=0;at<encoded.length;at+=65536){permit.dataCompletionBoundary();output.write(encoded,at,Math.min(65536,encoded.length-at));}output.getFD().sync();permit.dataCompletionBoundary();file.finishWrite(output);output=null;
            FileDescriptor fd=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);try{Os.fsync(fd);}finally{Os.close(fd);}permit.dataCompletionBoundary();
            byte[] actual=knownPlain(directory);try{require(MessageDigest.isEqual(actual,plain));knownBirth(directory);permit.dataCompletionBoundary();}finally{Arrays.fill(actual,(byte)0);}
            // Terminal proof/readback/ACK is still in the occupied original
            // native lane. Pending is removed last; failure restores the deny.
            permit.dataCompletionBoundary();Os.remove(knownPending(directory).getPath());syncBirthDirectory(directory);
        }catch(Throwable failure){if(began)try{pendingBirth(directory,pending);}catch(Throwable sticky){failure.addSuppressed(sticky);}throw failure;}
        finally{if(output!=null)file.failWrite(output);Arrays.fill(pending,(byte)0);if(encoded!=null)Arrays.fill(encoded,(byte)0);if(ciphertext!=null)Arrays.fill(ciphertext,(byte)0);}
    }
    private File birthMarker(File directory) throws Exception {
        File file=new File(directory,"local-v2-birth.claim");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;
    }
    private void exactBirth(File directory,LocalV2BirthPlan plan,byte[] marker) throws Exception {
        existingRecord(directory);File claim=birthMarker(directory);FileDescriptor fd=Os.open(claim.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
        try{StructStat opened=Os.fstat(fd),named=Os.lstat(claim.getPath());require(OsConstants.S_ISREG(opened.st_mode)&&opened.st_dev==named.st_dev&&opened.st_ino==named.st_ino&&opened.st_size==marker.length&&marker.length<=4096);
            byte[] actual=new byte[marker.length];try{int at=0;while(at<actual.length){int count=Os.read(fd,actual,at,actual.length-at);require(count>0);at+=count;}require(MessageDigest.isEqual(actual,marker));}finally{Arrays.fill(actual,(byte)0);}
        }finally{Os.close(fd);}
        try(State actual=read(directory)){byte[] readback=encode(actual);try{require(actual.generation==0&&actual.scope==null&&actual.entries.isEmpty()&&actual.nonce.equals(plan.nonce)
                &&digest(readback).equals(plan.checksum)&&MessageDigest.isEqual(readback,plan.plain));}finally{Arrays.fill(readback,(byte)0);}}
    }
    static LocalV2BirthReceipt localV2Birth(LocalV2BirthPlan original,PlanetChildVault.LocalV2ProfileBirthPermit permit) throws Exception {
        require(original!=null&&permit!=null);PlanetChildDataStore store=original.store;
        return store.locked(directory->{synchronized(original){require(!original.closed&&!original.used&&digest(original.plain).equals(original.checksum));original.used=true;}
            permit.consumeDataBirth(original.identity,original.nonce,original.checksum);byte[] marker=permit.dataMarker(original.identity,original.nonce,original.checksum);
            try{AtomicFile record=store.record(directory);KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
                require(!keys.containsAlias(store.identity+".aes")&&!record.getBaseFile().exists()&&!new File(record.getBaseFile().getPath()+".bak").exists()
                    &&!new File(record.getBaseFile().getPath()+".new").exists()&&!store.birthMarker(directory).exists()&&!store.knownRecord(directory).getBaseFile().exists());
                // Persist the claim BEFORE key birth. Unknown generation/add
                // outcomes retain it and can never become a fresh-key retry.
                FileDescriptor fd=Os.open(store.birthMarker(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
                try{int at=0;while(at<marker.length){permit.dataBoundary(original.identity,original.nonce,original.checksum);int wrote=Os.write(fd,marker,at,marker.length-at);require(wrote>0);at+=wrote;}Os.fsync(fd);}finally{Os.close(fd);}
                FileDescriptor parent=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_CLOEXEC,0);try{Os.fsync(parent);}finally{Os.close(parent);}
                permit.dataBoundary(original.identity,original.nonce,original.checksum);store.key(true,directory);permit.dataBoundary(original.identity,original.nonce,original.checksum);
                try(State state=decode(original.plain)){store.write(directory,state,()->permit.dataBoundary(original.identity,original.nonce,original.checksum));}
                store.exactBirth(directory,original,marker);permit.dataBirthKnown(original.identity,original.nonce,original.checksum);
                return new LocalV2BirthReceipt(original,marker);
            }catch(Throwable failure){store.closed=true;permit.dataBirthUnknown();throw failure;}finally{Arrays.fill(marker,(byte)0);}});
    }


    /** Closed LPC2 SDK trailer. Legacy LPD1/LPA3 bytes stay exact until a real
     * admitted collection CAS. Counters/tombstones belong to sealed profiles. */
    static final class CollectionResult implements AutoCloseable {
        final long revision;private final TreeMap<String,byte[]> values=new TreeMap<>();private boolean closed;
        private CollectionResult(long revision,Map<String,byte[]> values){this.revision=revision;for(Map.Entry<String,byte[]> entry:values.entrySet())this.values.put(entry.getKey(),entry.getValue().clone());}
        synchronized Map<String,byte[]> ownedValues() throws Exception {require(!closed);Map<String,byte[]> copied=new TreeMap<>();for(Map.Entry<String,byte[]> entry:values.entrySet())copied.put(entry.getKey(),entry.getValue().clone());return Collections.unmodifiableMap(copied);}
        synchronized boolean closedForSDK(){return closed;}
        public synchronized void close(){closed=true;for(byte[] value:values.values())Arrays.fill(value,(byte)0);values.clear();}
    }
    private static String collectionId(Scope scope,Purpose purpose){return scope.profileId+"\n"+purpose.name();}
    private static boolean collectionMember(Purpose purpose,String key,Scope scope) throws Exception {
        Scope saved=keyScope(purpose,key);if(!saved.tuple.equals(scope.tuple))return false;if(purpose==Purpose.history)return key.equals(scope.key(Purpose.history));require(purpose==Purpose.cache||purpose==Purpose.offline);
        return key.startsWith(scope.key(purpose)+"/item/"+(purpose==Purpose.cache?"favorite/":"offline-package/"));
    }
    private static long collectionNext(long previous) throws Exception {require(previous>=0&&previous<MAX_SAFE-1);return previous+1;}
    private static void collectionCAS(long actual,Long expected) throws Exception {require(expected!=null&&expected>=0&&expected<MAX_SAFE-1&&actual==expected);}
    private static void validateCollections(State state) throws Exception {
        require(state.collectionRevisions.size()<=12&&state.tombstones.size()<=MAX_SLOTS&&(!state.sdkCollections||state.admissionBinding!=null));
        if(state.sdkUnboundBirth!=null)require(state.sdkCollections&&state.seals.isEmpty()&&identifier(state.sdkUnboundBirth)&&checksum(state.sdkUnboundContent)&&state.scope==null&&state.entries.isEmpty()&&state.collectionRevisions.isEmpty()&&state.tombstones.isEmpty());else require(state.sdkUnboundContent==null);
        if(!state.sdkCollections){require(state.collectionRevisions.isEmpty()&&state.tombstones.isEmpty());return;}
        for(Map.Entry<String,Long> entry:state.collectionRevisions.entrySet()){String[] pair=entry.getKey().split("\n",-1);require(pair.length==2&&state.seals.containsKey(pair[0])&&Arrays.asList("history","cache","offline").contains(pair[1])&&positive(entry.getValue())&&entry.getValue()<MAX_SAFE);}
        for(Map.Entry<String,Long> entry:state.tombstones.entrySet()){String[] pair=entry.getKey().split("\n",-1);require(pair.length==2);Purpose purpose=Purpose.valueOf(pair[0]);require(purpose==Purpose.cache||purpose==Purpose.offline);Scope saved=keyScope(purpose,pair[1]);Seal seal=state.seals.get(saved.profileId);require(!state.entries.containsKey(entry.getKey())&&seal!=null&&seal.scope.tuple.equals(saved.tuple)&&positive(entry.getValue())&&entry.getValue()<MAX_SAFE&&collectionMember(purpose,pair[1],saved));}
    }
    private static void encodeCollections(State state,DataOutputStream out) throws Exception {
        validateCollections(state);if(!state.sdkCollections)return;out.writeInt(0x4c504332);out.writeBoolean(state.sdkUnboundBirth!=null);if(state.sdkUnboundBirth!=null){out.writeUTF(state.sdkUnboundBirth);out.writeUTF(state.sdkUnboundContent);}
        out.writeInt(state.collectionRevisions.size());for(Map.Entry<String,Long> entry:state.collectionRevisions.entrySet()){out.writeUTF(entry.getKey());out.writeLong(entry.getValue());}out.writeInt(state.tombstones.size());for(Map.Entry<String,Long> entry:state.tombstones.entrySet()){out.writeUTF(entry.getKey());out.writeLong(entry.getValue());}
    }
    private static void decodeCollections(State state,DataInputStream in) throws Exception {
        require(in.readInt()==0x4c504332&&state.admissionBinding!=null);state.sdkCollections=true;int flag=in.readUnsignedByte();require(flag<=1);if(flag==1){state.sdkUnboundBirth=in.readUTF();state.sdkUnboundContent=in.readUTF();}
        int count=in.readInt();require(count>=0&&count<=12);for(int i=0;i<count;i++){String id=in.readUTF();long revision=in.readLong();require(!state.collectionRevisions.containsKey(id));state.collectionRevisions.put(id,revision);}count=in.readInt();require(count>=0&&count<=MAX_SLOTS);for(int i=0;i<count;i++){String id=in.readUTF();long revision=in.readLong();require(id.length()<=4120&&!state.tombstones.containsKey(id));state.tombstones.put(id,revision);}validateCollections(state);
    }
    private static void knownUnboundOrigin(State state,String id,String nonce,String content,String empty,Map<String,String> profiles) throws Exception {
        require(state.admissionBinding==null&&state.scope==null&&state.pendingMigration==null&&profiles.size()==1&&content.equals(profiles.get(id))&&state.generation==0&&state.nonce.equals(nonce)&&state.entries.isEmpty()&&state.seals.isEmpty()&&!state.sdkCollections&&state.tombstones.isEmpty()&&state.collectionRevisions.isEmpty());byte[] plain=encode(state);try{require(digest(plain).equals(empty));}finally{Arrays.fill(plain,(byte)0);}
    }
    private static void migrateTombstones(State state,Scope future) throws Exception {
        if(future==null)return;TreeMap<String,Long> next=new TreeMap<>();for(Map.Entry<String,Long> entry:state.tombstones.entrySet()){String[] pair=entry.getKey().split("\n",-1);require(pair.length==2);Purpose purpose=Purpose.valueOf(pair[0]);Scope old=keyScope(purpose,pair[1]);if(!old.profileId.equals(future.profileId)){next.put(entry.getKey(),entry.getValue());continue;}String[] pieces=pair[1].split("/",-1);require(pieces.length>=4);String key=future.itemKey(purpose,pieces[pieces.length-2],pieces[pieces.length-1]),id=purpose.name()+"\n"+key;require(!next.containsKey(id));next.put(id,collectionNext(entry.getValue()));}state.tombstones.clear();state.tombstones.putAll(next);
    }
    private File collectionPending(File directory) throws Exception {File file=new File(directory,"local-v2-collection.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void exclusiveCollectionMarker(File directory,byte[] marker,Check check) throws Exception {
        FileDescriptor fd=Os.open(collectionPending(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);try{int at=0;while(at<marker.length){check.check();int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);
    }
    CollectionResult admittedCollection(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Purpose purpose,Long expectedRevision,Map<String,byte[]> replacement,String commandId) throws Exception {
        require(admission!=null&&lease!=null&&Arrays.asList(Purpose.history,Purpose.cache,Purpose.offline).contains(purpose)&&(replacement==null)==(expectedRevision==null)&&commandId!=null&&commandId.matches("[a-f0-9]{32}"));Map<String,byte[]> owned=new TreeMap<>();try{
        if(replacement!=null){require(replacement.size()<=64);int total=0;for(Map.Entry<String,byte[]> entry:replacement.entrySet()){require(entry.getKey()!=null&&entry.getValue()!=null&&entry.getValue().length>0&&entry.getValue().length<=MAX_VALUE_BYTES&&total<=MAX_SNAPSHOT_BYTES-entry.getValue().length);total+=entry.getValue().length;owned.put(entry.getKey(),entry.getValue().clone());}}
        final Map<String,byte[]> values=replacement==null?null:owned;return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);String id=collectionId(lease.scope,purpose);long revision=state.collectionRevisions.getOrDefault(id,0L);Map<String,Stored> old=new TreeMap<>();for(Map.Entry<String,Stored> entry:state.entries.entrySet()){String[] pair=entry.getKey().split("\n",-1);require(pair.length==2);if(pair[0].equals(purpose.name())&&collectionMember(purpose,pair[1],lease.scope)){admission.validate(purpose,pair[1],entry.getValue().value);old.put(pair[1],entry.getValue());}}require(old.size()<=64);
            if(values==null){Map<String,byte[]> copy=new TreeMap<>();for(Map.Entry<String,Stored> entry:old.entrySet())copy.put(entry.getKey(),entry.getValue().value);CollectionResult answer=new CollectionResult(revision,copy);try{admission.check();return answer;}catch(Exception failed){answer.close();throw failed;}}
            collectionCAS(revision,expectedRevision);for(Map.Entry<String,byte[]> entry:values.entrySet()){require(collectionMember(purpose,entry.getKey(),lease.scope));envelope(purpose,entry.getKey(),lease.scope,entry.getValue());admission.validate(purpose,entry.getKey(),entry.getValue());}
            byte[] marker=("LP-LOCAL-V2-COLLECTION\n"+identity+"\n"+commandId+"\n"+admission.binding()+"\n"+id+"\n"+(revision+1)+"\n").getBytes(StandardCharsets.US_ASCII);boolean markerAttempted=false;
            try{markerAttempted=true;exclusiveCollectionMarker(directory,marker,admission::check);state.sdkCollections=true;state.collectionRevisions.put(id,revision+1);Set<String> keys=new TreeSet<>(old.keySet());keys.addAll(values.keySet());for(String key:keys){String compound=purpose.name()+"\n"+key;Stored prior=state.entries.get(compound);long next=collectionNext(prior==null?state.tombstones.getOrDefault(compound,0L):prior.revision);Stored removed=state.entries.remove(compound);if(removed!=null)Arrays.fill(removed.value,(byte)0);if(values.containsKey(key)){state.tombstones.remove(compound);state.entries.put(compound,new Stored(next,values.get(key).clone()));}else{require(purpose!=Purpose.history);state.tombstones.put(compound,next);}}
                validateCollections(state);write(directory,state,admission::check);try(State actual=read(directory)){admittedLive(admission,lease,actual);require(Long.valueOf(revision+1).equals(actual.collectionRevisions.get(id)));for(String key:keys){String compound=purpose.name()+"\n"+key;Stored saved=actual.entries.get(compound);if(values.containsKey(key)){require(saved!=null&&MessageDigest.isEqual(saved.value,values.get(key))&&!actual.tombstones.containsKey(compound));admission.validate(purpose,key,saved.value);}else require(saved==null&&Objects.equals(actual.tombstones.get(compound),state.tombstones.get(compound)));}}
                byte[] pending=boundedRegular(collectionPending(directory),4096);try{require(MessageDigest.isEqual(pending,marker));}finally{Arrays.fill(pending,(byte)0);}admission.collectionCommandKnown(commandId);CollectionResult answer=new CollectionResult(revision+1,values);try{admission.collectionCommandReady(commandId);return answer;}catch(Exception failure){answer.close();throw failure;}
            }catch(Exception failure){if(markerAttempted)admission.collectionUnknown();throw failure;}finally{Arrays.fill(marker,(byte)0);}
        }});}finally{if(owned!=null)for(byte[] value:owned.values())Arrays.fill(value,(byte)0);}
    }
    void collectionComplete(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId) throws Exception {
        locked(directory->{admission.check();try(State state=read(directory)){admittedLive(admission,lease,state);admission.collectionCommandJoined(commandId);File file=collectionPending(directory);byte[] pending=boundedRegular(file,4096);boolean clearing=false;
            try{String[] fields=utf8(pending).split("\n",-1);require(fields.length==8&&"LP-LOCAL-V2-COLLECTION".equals(fields[0])&&identity.equals(fields[1])&&commandId.equals(fields[2])&&admission.binding().equals(fields[3])&&lease.scope.profileId.equals(fields[4])&&Arrays.asList("history","cache","offline").contains(fields[5])&&fields[6].matches("[1-9][0-9]{0,15}")&&fields[7].isEmpty());long revision=Long.parseLong(fields[6]);require(revision<MAX_SAFE&&Long.valueOf(revision).equals(state.collectionRevisions.get(fields[4]+"\n"+fields[5])));admission.check();clearing=true;Os.remove(file.getPath());syncBirthDirectory(directory);return null;}
            catch(Exception failure){if(clearing&&!file.exists())try{exclusiveCollectionMarker(directory,pending,()->{});}catch(Exception sticky){failure.addSuppressed(sticky);}admission.collectionUnknown();throw failure;}finally{Arrays.fill(pending,(byte)0);}
        }});
    }
    /** Actual original reader already holds Vault. Inspection has no lease,
     * package scope or key birth and cannot adopt an unknown empty namespace. */
    /** One read of the actual encrypted store under Vault -> DataStore locks.
     * This permission is native original-Gate-owned; no compiled content/right
     * permission is created. Values, scopes, filenames and keys never leave. */
    static byte[] sdkParentExport(PlanetChildVault.LocalV2ExportReadPermit permit) throws Exception {
        permit.check(); PlanetChildDataStore store=new PlanetChildDataStore(permit.context());
        return store.locked(directory->{
            permit.check();store.existingRecord(directory);store.noPendingOperations(directory);
            byte[] plain=store.knownPlain(directory),claim=null,before=null,after=null,result=null;boolean handed=false;
            try {
                PlanetChildVault.LocalV2KnownBirth birth=permit.knownBirth(store.identity,plain);
                claim=store.boundedRegular(store.birthMarker(directory),4096);require(digest(claim).equals(birth.claimChecksum));
                try(State state=store.read(directory)) {
                    require(state.scope==null&&state.pendingMigration==null);
                    Map<String,String> profiles=permit.profiles();
                    if(state.admissionBinding==null)knownUnboundOrigin(state,birth.profileId,birth.nonce,birth.contentBinding,birth.emptyChecksum,profiles);
                    else require(state.admissionBinding.equals(permit.binding())&&sealBindings(state).equals(profiles));
                    before=encode(state);Map<String,Object> personal=parentExportProjection(state,permit.profileId());
                    result=permit.encode(personal);permit.check();
                    try(State readback=store.read(directory)){after=encode(readback);require(MessageDigest.isEqual(before,after));}
                    permit.check();handed=true;return result;
                }
            } finally {Arrays.fill(plain,(byte)0);if(claim!=null)Arrays.fill(claim,(byte)0);if(before!=null)Arrays.fill(before,(byte)0);if(after!=null)Arrays.fill(after,(byte)0);if(!handed&&result!=null)Arrays.fill(result,(byte)0);}
        });
    }
    private static Map<String,Object> exportRow(Object... fields) {
        Map<String,Object> row=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)row.put((String)fields[i],fields[i+1]);return row;
    }
    private static Map<String,Object> exportReference(JSONObject ref)throws Exception {
        reference(ref);return exportRow("kind",text(ref.get("kind")),"id",text(ref.get("id")),"contentChecksum",text(ref.get("contentChecksum")));
    }
    /** Deliberate allow-list: cached/licensed payloads and route snapshots are
     * not copied. Native scopes, boot/attempt state and sibling identities do
     * not occur in this model. Empty data is allowed only in a decoded store. */
    private static Map<String,Object> parentExportProjection(State state,String profile)throws Exception {
        require(identifier(profile));validateSeals(state);validateCollections(state);validateAppearance(state);validateJourney(state);validatePassport(state);validateDownloads(state);
        Map<String,Object> collections=new LinkedHashMap<>();
        for(Purpose purpose:new Purpose[]{Purpose.cache,Purpose.history,Purpose.offline,Purpose.search}){
            List<Object> refs=new ArrayList<>();long revision=state.collectionRevisions.getOrDefault(profile+"\n"+purpose.name(),0L);
            for(Map.Entry<String,Stored> item:state.entries.entrySet()){
                String[] parts=item.getKey().split("\n",-1);require(parts.length==2);if(!purpose.name().equals(parts[0]))continue;
                Scope scope=keyScope(purpose,parts[1]);if(!profile.equals(scope.profileId))continue;
                envelope(purpose,parts[1],scope,item.getValue().value);
                JSONObject row=new JSONObject(utf8(item.getValue().value));
                if(purpose==Purpose.history||purpose==Purpose.search){JSONArray rows=row.getJSONArray("references");for(int i=0;i<rows.length();i++)refs.add(exportReference(rows.getJSONObject(i)));if(purpose==Purpose.search)revision=item.getValue().revision;}
                else refs.add(exportReference(row.getJSONArray("entries").getJSONObject(0).getJSONObject("reference")));
            }
            require(refs.size()<=(purpose==Purpose.history?100:purpose==Purpose.search?MAX_SLOTS:64));
            collections.put(purpose==Purpose.cache?"favorites":purpose==Purpose.history?"recent":purpose==Purpose.offline?"offline":"search",exportRow("revision",revision,"references",refs));
        }
        AppearanceEntry appearance=state.appearances.get(profile);JourneyEntry journeys=state.journeys.get(profile);PassportEntry passport=state.passports.get(profile);
        List<Object> progress=new ArrayList<>();if(journeys!=null)for(PlanetChildJourney.Progress saved:journeys.values.values())progress.add(saved.dto());
        List<Object> countries=new ArrayList<>(),credits=new ArrayList<>(),completed=new ArrayList<>(),awards=new ArrayList<>(),routes=new ArrayList<>();
        if(passport!=null){PlanetChildPassport.Ledger ledger=passport.ledger;countries.addAll(ledger.countries);
            for(PlanetChildPassport.Credit c:ledger.credits)credits.add(exportRow("journeyId",c.journeyId,"journeyVersion",c.journeyVersion,"contentVersion",c.contentVersion,"nodeId",c.nodeId,"kind",c.kind,"entityId",c.entityId));
            for(PlanetChildPassport.CompletedJourney c:ledger.completedJourneys)completed.add(exportRow("journeyId",c.journeyId,"journeyVersion",c.journeyVersion,"contentVersion",c.contentVersion,"nodeIds",c.nodeIds));
            for(PlanetChildPassport.Award a:ledger.awards)awards.add(exportRow("programId",a.programId,"programVersion",a.programVersion,"badgeId",a.badgeId,"ruleVersion",a.ruleVersion,"journeyId",a.journeyId,"journeyVersion",a.journeyVersion,"contentVersion",a.contentVersion,"trigger",a.trigger,"nodeIds",a.nodeIds));
            for(PlanetChildPassport.Route route:ledger.routes)routes.add(exportRow("journeyId",route.journeyId,"journeyVersion",route.journeyVersion,"contentVersion",route.contentVersion,"locale",route.locale,"bytes",(long)route.byteLength(),"sha256",route.snapshotChecksum));
        }
        List<Object> objects=new ArrayList<>(),stages=new ArrayList<>();
        for(PlanetChildRouteDownload.ObjectRef ref:state.downloads.objects.values())if(profile.equals(ref.profileId))objects.add(exportRow("sha256",ref.checksum,"mime",ref.mime,"bytes",(long)ref.bytes));
        for(PlanetChildRouteDownload.Stage stage:state.downloads.stages.values())if(profile.equals(stage.profileId))stages.add(exportRow("journeyId",stage.route.journeyId,"locale",stage.route.locale,"status",stage.ready()?"saved":"partial","completedMediaItems",(long)stage.completed,"totalMediaItems",(long)stage.objects().size(),"reusedMediaItems",(long)stage.reused));
        Map<String,Object> projection=exportRow("collections",collections,"appearance",exportRow("revision",appearance==null?0L:appearance.revision,"selection",appearance==null||appearance.selection==null?null:appearance.selection.dto()),
            "journeys",exportRow("revision",journeys==null?0L:journeys.revision,"activeJourneyId",journeys==null?null:journeys.activeJourneyId,"progress",progress),
            "passport",exportRow("revision",passport==null?0L:passport.revision,"countries",countries,"credits",credits,"completedJourneys",completed,"awards",awards,"routes",routes),
            "downloads",exportRow("objects",objects,"routes",stages));TreeMap<String,ReadingEntry> positions=state.reading.get(profile);if(positions!=null){List<Object> rows=new ArrayList<>();for(ReadingEntry entry:positions.values())rows.add(exportRow("revision",entry.revision,"position",entry.position.dto()));projection.put("readingPositions",rows);}return projection;
    }
    /** Explicit synthetic codec fixture. It returns project-authored bytes only;
     * no read permit, native Gate, OS saved receipt or runtime PASS is minted. */
    private static Map<String,Object> fixtureParentExportProfile(){return exportRow("id","fixture-reader-one","label","Читатель","exactAge",9L,"ageBand","9-11","locale","ru","ageConfirmedAt","2026-10-01T00:00:00.000Z","readingLevel","plain","allowedTopics",null,"blockedTopics",Collections.emptyList(),"soundEnabled",false,"motion","calm","narrationEnabled",false,"localeLocked",false);}
    static byte[] fixtureParentExportBytes(Context context,boolean populated)throws Exception {
        fixtureAppearanceContext(context);try(State state=populated?fixturePassportState():new State()){
            state.nonce="11111111111111111111111111111111";
            if(populated){fixtureRouteFacts(context,state,"fixture-reader-one");fixtureRouteFacts(context,state,"fixture-reader-two");Scope scope=state.seals.get("fixture-reader-one").scope;String key=scope.itemKey(Purpose.cache,"favorite","favorite-one");Stored saved=state.entries.get(Purpose.cache.name()+"\n"+key);
                JSONObject envelope=new JSONObject(utf8(saved.value));envelope.getJSONArray("entries").getJSONObject(0).getJSONObject("payload").put("text","LICENSED-BODY-SENTINEL");Arrays.fill(saved.value,(byte)0);state.entries.put(Purpose.cache.name()+"\n"+key,new Stored(saved.revision,envelope.toString().getBytes(StandardCharsets.UTF_8)));}
            Map<String,Object> profile=fixtureParentExportProfile();
            byte[] before=encode(state);try{byte[] bytes=PlanetChildVault.parentExportCodec(profile,parentExportProjection(state,"fixture-reader-one"));byte[] after=encode(state);try{require(MessageDigest.isEqual(before,after));return bytes;}finally{Arrays.fill(after,(byte)0);}}finally{Arrays.fill(before,(byte)0);}
        }
    }
    static boolean fixtureParentExportScenario(Context context,String scenario)throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("isolation","revision-digest","corrupt","no-secret-profile").contains(scenario));
        try(State state=fixturePassportState()){
            byte[] before=PlanetChildVault.parentExportCodec(fixtureParentExportProfile(),parentExportProjection(state,"fixture-reader-one"));
            try{if("isolation".equals(scenario)){PassportEntry sibling=state.passports.get("fixture-reader-two");state.passports.put("fixture-reader-two",new PassportEntry(sibling.revision+1,new PlanetChildPassport.Ledger(Arrays.asList("sibling-secret-country"),Collections.emptyList())));state.appearances.put("fixture-reader-two",new AppearanceEntry(99,fixtureAppearanceSelection("two")));byte[] after=PlanetChildVault.parentExportCodec(fixtureParentExportProfile(),parentExportProjection(state,"fixture-reader-one"));try{require(MessageDigest.isEqual(before,after)&&!utf8(after).contains("sibling-secret")&&!utf8(after).contains("fixture-reader-two"));return true;}finally{Arrays.fill(after,(byte)0);}}
                if("revision-digest".equals(scenario)){Map<String,Object> first=parentExportProjection(state,"fixture-reader-one");state.collectionRevisions.put("fixture-reader-one\ncache",6L);Map<String,Object> second=parentExportProjection(state,"fixture-reader-one");byte[] a=PlanetChildVault.parentExportCodec(fixtureParentExportProfile(),first),b=PlanetChildVault.parentExportCodec(fixtureParentExportProfile(),second);try{require(!digest(a).equals(digest(b)));return true;}finally{Arrays.fill(a,(byte)0);Arrays.fill(b,(byte)0);}}
                if("corrupt".equals(scenario)){byte[] actual=encode(state),broken=Arrays.copyOf(actual,actual.length+1);try{boolean denied=false;try(State unexpected=decode(broken)){}catch(Exception failure){denied=true;}require(denied);return true;}finally{Arrays.fill(actual,(byte)0);Arrays.fill(broken,(byte)0);}}
                Map<String,Object> invalid=fixtureParentExportProfile();invalid.put("verifier","SECRET");boolean denied=false;try{byte[] unexpected=PlanetChildVault.parentExportCodec(invalid,parentExportProjection(state,"fixture-reader-one"));Arrays.fill(unexpected,(byte)0);}catch(Exception failure){denied=true;}require(denied);return true;
            }finally{Arrays.fill(before,(byte)0);}
        }
    }
    static void sdkInspectOriginal(PlanetChildVault.LocalV2SDKReadPermit permit) throws Exception {
        permit.check();Context context=permit.context();if(permit.originalEmptyRegistry()){
            File directory=new File(context.getNoBackupFilesDir().getCanonicalFile(),"literary-planet-child-data-v1");require(directory.getAbsoluteFile().equals(directory.getCanonicalFile()));boolean absent=false;try{Os.lstat(directory.getPath());}catch(android.system.ErrnoException missing){require(missing.errno==OsConstants.ENOENT);absent=true;}require(absent);KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);require(!keys.containsAlias(context.getPackageName()+"."+directory.getName()+".aes"));permit.check();return;
        }
        PlanetChildDataStore store=new PlanetChildDataStore(context,null,permit);store.locked(directory->{permit.check();store.existingRecord(directory);store.noPendingExceptDownload(directory);byte[] plain=store.knownPlain(directory),claim=null;try{PlanetChildVault.LocalV2KnownBirth birth=permit.knownBirth(store.identity,plain);claim=store.boundedRegular(store.birthMarker(directory),4096);require(digest(claim).equals(birth.claimChecksum));try(State state=store.read(directory)){require(state.pendingMigration==null);Map<String,String> profiles=permit.profiles();if(state.admissionBinding==null)knownUnboundOrigin(state,birth.profileId,birth.nonce,birth.contentBinding,birth.emptyChecksum,profiles);else{require(state.admissionBinding.equals(permit.binding())&&sealBindings(state).equals(profiles));}store.reanchorDownloadCheckpoint(directory,state,permit);require(state.scope==null);permit.check();return null;}}finally{Arrays.fill(plain,(byte)0);if(claim!=null)Arrays.fill(claim,(byte)0);}});
    }

    /** AUTHORED_NOT_RUN leaf fixtures. Debug-only structural bytes exercise the
     * actual closed codec/CAS helpers; no native permit, signature or lease is minted. */
    static boolean fixtureSDKCollections(Context context,String scenario) throws Exception {
        require(context!=null&&"ru.probpera.literaryplanet.dev".equals(context.getPackageName())&&(context.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        require(Arrays.asList("trailer","tombstones").contains(scenario));String hash="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",content="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
        Scope reader=new Scope("fixture-reader",2,9,"ru","fixture-policy",hash,"fixture-package",1,hash),sibling=new Scope("fixture-sibling",7,11,"en","fixture-policy",hash,"fixture-package",1,hash);
        byte[] siblingValue=new JSONObject().put("schemaVersion",1).put("scope",fixtureSDKScope(sibling)).put("references",new JSONArray()).toString().getBytes(StandardCharsets.UTF_8);
        String siblingId=Purpose.history.name()+"\n"+sibling.key(Purpose.history),favorite=reader.itemKey(Purpose.cache,"favorite","one"),compound=Purpose.cache.name()+"\n"+favorite;
        byte[] legacy=null,extended=null;try(State state=new State()){
            state.nonce="cccccccccccccccccccccccccccccccc";state.admissionBinding=hash;state.seals.put(reader.profileId,new Seal(reader,content));state.seals.put(sibling.profileId,new Seal(sibling,content));state.entries.put(siblingId,new Stored(7,siblingValue.clone()));
            legacy=encode(state);try(State original=decode(legacy)){byte[] exact=encode(original);try{require(MessageDigest.isEqual(legacy,exact)&&!original.sdkCollections);}finally{Arrays.fill(exact,(byte)0);}}
            state.sdkCollections=true;state.collectionRevisions.put(collectionId(reader,Purpose.cache),2L);state.collectionRevisions.put(collectionId(sibling,Purpose.history),9L);state.tombstones.put(compound,2L);extended=encode(state);
            require(extended.length>legacy.length&&MessageDigest.isEqual(legacy,Arrays.copyOf(extended,legacy.length)));
            try(State reopened=decode(extended)){
                require(reopened.sdkCollections&&reopened.scope==null&&reopened.seals.get(sibling.profileId).scope.tuple.equals(sibling.tuple)&&reopened.entries.get(siblingId).revision==7&&MessageDigest.isEqual(reopened.entries.get(siblingId).value,siblingValue));
                require(reopened.collectionRevisions.get(collectionId(sibling,Purpose.history))==9L&&reopened.tombstones.get(compound)==2L&&!reopened.entries.containsKey(compound));
                byte[] exact=encode(reopened);try{require(MessageDigest.isEqual(extended,exact));}finally{Arrays.fill(exact,(byte)0);}
                if("trailer".equals(scenario)){
                    for(int missing:new int[]{1,8,32}){boolean refused=false;try(State ignored=decode(Arrays.copyOf(extended,extended.length-missing))){}catch(Exception closed){refused=true;}require(refused);}
                    reopened.tombstones.put(Purpose.cache.name()+"\n"+new Scope("unknown-orphan",2,9,"ru","fixture-policy",hash,"fixture-package",1,hash).itemKey(Purpose.cache,"favorite","one"),1L);
                    boolean refused=false;try{encode(reopened);}catch(Exception closed){refused=true;}require(refused);
                }else{
                    collectionCAS(reopened.collectionRevisions.get(collectionId(reader,Purpose.cache)),2L);boolean stale=false;try{collectionCAS(2,0L);}catch(Unavailable conflict){stale=true;}require(stale&&collectionNext(1)==2&&collectionNext(reopened.tombstones.get(compound))==3);
                    JSONObject row=new JSONObject().put("reference",new JSONObject().put("kind","favorite").put("id","one").put("contentChecksum",hash)).put("payload",new JSONObject().put("title","Synthetic native wrapper").put("text","").put("terms",new JSONArray()).put("references",new JSONArray()));
                    byte[] nativeBytes=new JSONObject().put("schemaVersion",1).put("scope",fixtureSDKScope(reader)).put("entries",new JSONArray().put(row)).toString().getBytes(StandardCharsets.UTF_8);
                    try{reopened.entries.put(compound,new Stored(collectionNext(reopened.tombstones.get(compound)),nativeBytes.clone()));reopened.tombstones.remove(compound);reopened.collectionRevisions.put(collectionId(reader,Purpose.cache),collectionNext(2));byte[] readded=encode(reopened);
                        try(State actual=decode(readded)){require(actual.entries.get(compound).revision==3&&!actual.tombstones.containsKey(compound)&&actual.collectionRevisions.get(collectionId(reader,Purpose.cache))==3L&&actual.entries.get(siblingId).revision==7&&MessageDigest.isEqual(actual.entries.get(siblingId).value,siblingValue)&&actual.collectionRevisions.get(collectionId(sibling,Purpose.history))==9L);}finally{Arrays.fill(readded,(byte)0);}
                    }finally{Arrays.fill(nativeBytes,(byte)0);}boolean exhausted=false;try{collectionNext(MAX_SAFE-1);}catch(Unavailable closed){exhausted=true;}require(exhausted);
                }
            }return true;
        }finally{Arrays.fill(siblingValue,(byte)0);if(legacy!=null)Arrays.fill(legacy,(byte)0);if(extended!=null)Arrays.fill(extended,(byte)0);}
    }
    private static JSONObject fixtureSDKScope(Scope scope) throws Exception {
        return new JSONObject().put("schemaVersion",1).put("namespace","child").put("profileId",scope.profileId).put("profileRevision",scope.profileRevision).put("exactAge",scope.exactAge).put("locale",scope.locale).put("policyVersion",scope.policyVersion).put("policyChecksum",scope.policyChecksum).put("packageId",scope.packageId).put("packageVersion",scope.packageVersion).put("packageChecksum",scope.packageChecksum);
    }
    /** LPP1 appearance extension is absent in legacy bytes; reads never seed,
     * migrate, repair, clear or manufacture another profile's choice. */
    private static final class AppearanceEntry {
        final long revision;final PlanetChildAppearance.Selection selection;
        AppearanceEntry(long revision,PlanetChildAppearance.Selection selection){this.revision=revision;this.selection=selection;}
    }
    static final class AppearanceResult implements AutoCloseable {
        final String profileId;final long revision;final PlanetChildAppearance.Selection selection;private boolean closed;
        private AppearanceResult(String profileId,long revision,PlanetChildAppearance.Selection selection){this.profileId=profileId;this.revision=revision;this.selection=selection;}
        synchronized Map<String,Object> dto() throws Exception {require(!closed);Map<String,Object> out=new LinkedHashMap<>();out.put("profileId",profileId);out.put("revision",revision);out.put("selection",selection==null?null:selection.dto());return Collections.unmodifiableMap(out);}
        synchronized boolean closedForSDK(){return closed;}
        public synchronized void close(){closed=true;}
    }
    private static void validateAppearance(State state) throws Exception {
        if(!state.sdkAppearance){require(state.appearances.isEmpty());return;}
        require(state.sdkCollections&&state.admissionBinding!=null&&state.sdkUnboundBirth==null&&state.appearances.size()<=4&&state.seals.keySet().containsAll(state.appearances.keySet()));
        for(Map.Entry<String,AppearanceEntry> row:state.appearances.entrySet()){require(identifier(row.getKey())&&row.getValue().revision>0);PlanetChildAppearance.revision(row.getValue().revision);if(row.getValue().selection!=null){byte[] bytes=row.getValue().selection.encode();try{require(PlanetChildAppearance.decode(bytes).equals(row.getValue().selection));}finally{Arrays.fill(bytes,(byte)0);}}}
    }
    private static void encodeAppearance(State state,DataOutputStream out) throws Exception {
        validateAppearance(state);if(!state.sdkAppearance)return;out.writeInt(0x4c505031);out.writeByte(1);out.writeByte(state.appearances.size());
        for(Map.Entry<String,AppearanceEntry> row:state.appearances.entrySet()){out.writeUTF(row.getKey());AppearanceEntry entry=row.getValue();out.writeLong(entry.revision);out.writeBoolean(entry.selection!=null);if(entry.selection!=null){byte[] bytes=entry.selection.encode();try{out.writeInt(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}}
    }
    private static void decodeAppearance(State state,DataInputStream in) throws Exception {
        require(in.readInt()==0x4c505031&&in.readUnsignedByte()==1&&state.sdkCollections);state.sdkAppearance=true;int count=in.readUnsignedByte();require(count<=4);
        for(int i=0;i<count;i++){String profile=in.readUTF();long revision=in.readLong();int flag=in.readUnsignedByte();require(flag<=1&&!state.appearances.containsKey(profile));PlanetChildAppearance.Selection selection=null;if(flag==1){int length=in.readInt();require(length>0&&length<=PlanetChildAppearance.MAX_BYTES&&length<=in.available());byte[] bytes=new byte[length];try{in.readFully(bytes);selection=PlanetChildAppearance.decode(bytes);}finally{Arrays.fill(bytes,(byte)0);}}state.appearances.put(profile,new AppearanceEntry(revision,selection));}validateAppearance(state);
    }
    private static long appearanceNext(long current,long expected) throws Exception {require(current==expected);return PlanetChildAppearance.next(current);}
    private static void migrateAppearance(State state) throws Exception {validateAppearance(state);require(sealBindings(state).keySet().containsAll(state.appearances.keySet()));}
    private File appearancePending(File directory) throws Exception {File file=new File(directory,"local-v2-appearance.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void exclusiveAppearanceMarker(File directory,byte[] marker,Check check) throws Exception {
        require(marker!=null&&marker.length>0&&marker.length<=4096);FileDescriptor fd=Os.open(appearancePending(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
        try{int at=0;while(at<marker.length){check.check();int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);
    }
    private byte[] appearanceMarkerBytes(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId,long revision,PlanetChildAppearance.Selection selection) throws Exception {
        byte[] bytes=selection==null?"LP-LOCAL-V2-APPEARANCE-SELECTION-ABSENT\0v1".getBytes(StandardCharsets.US_ASCII):selection.encode();try{return ("LP-LOCAL-V2-APPEARANCE\n"+identity+"\n"+commandId+"\n"+admission.binding()+"\n"+lease.scope.profileId+"\n"+lease.generation+"\n"+lease.nonce+"\n"+revision+"\n"+digest(bytes)+"\n").getBytes(StandardCharsets.US_ASCII);}finally{Arrays.fill(bytes,(byte)0);}
    }
    AppearanceResult admittedAppearance(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Long expected,PlanetChildVault.LocalV2SceneSelectionPermit permit,String commandId) throws Exception {
        require(admission!=null&&lease!=null&&(expected==null)==(permit==null)&&commandId!=null&&commandId.matches("[a-f0-9]{32}"));
        return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);validateAppearance(state);String profile=lease.scope.profileId;AppearanceEntry prior=state.appearances.get(profile);long revision=prior==null?0:prior.revision;
            if(permit==null){AppearanceResult result=new AppearanceResult(profile,revision,prior==null?null:prior.selection);try{admission.check();return result;}catch(Exception failure){result.close();throw failure;}}
            long next=appearanceNext(revision,expected);permit.capturePrior(admission,profile,revision,prior==null?null:prior.selection,next);PlanetChildAppearance.Selection selection=permit.selection(admission);require(profile.equals(permit.profileId(admission)));byte[] marker=appearanceMarkerBytes(admission,lease,commandId,next,selection);boolean markerAttempted=false;
            try{markerAttempted=true;exclusiveAppearanceMarker(directory,marker,()->permit.check(admission));state.sdkCollections=true;state.sdkAppearance=true;state.appearances.put(profile,new AppearanceEntry(next,selection));validateAppearance(state);write(directory,state,()->permit.check(admission));
                try(State actual=read(directory)){admittedLive(admission,lease,actual);permit.check(admission);AppearanceEntry saved=actual.appearances.get(profile);require(saved!=null&&saved.revision==next&&java.util.Objects.equals(selection,saved.selection));byte[] before=encode(state),after=encode(actual);try{require(MessageDigest.isEqual(before,after));}finally{Arrays.fill(before,(byte)0);Arrays.fill(after,(byte)0);}}
                byte[] pending=boundedRegular(appearancePending(directory),4096);try{require(MessageDigest.isEqual(pending,marker));}finally{Arrays.fill(pending,(byte)0);}admission.appearanceCommandKnown(commandId);AppearanceResult result=new AppearanceResult(profile,next,selection);try{admission.appearanceCommandReady(commandId);return result;}catch(Exception failure){result.close();throw failure;}
            }catch(Throwable failure){if(markerAttempted){closed=true;}if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}finally{Arrays.fill(marker,(byte)0);}
        }});
    }
    /** Capture keeps the durable marker until the actual SDK command is done,
     * its native consumer owns the result, and all final admission fences pass.
     * Observed completion/callback failure retains DENY, never rollback.
     * No caller can construct, acknowledge or supply the receipt bytes. */
    static final class AppearanceCompletion implements AutoCloseable {
        private final PlanetChildDataStore store;private final byte[] marker;private boolean closed,completed;
        private AppearanceCompletion(PlanetChildDataStore store,byte[] marker){this.store=store;this.marker=marker.clone();}
        synchronized void complete() throws Exception {require(!closed&&!completed);store.locked(directory->{require(!store.closed);File file=store.appearancePending(directory);byte[] actual=store.boundedRegular(file,4096);try{require(MessageDigest.isEqual(actual,marker));Os.remove(file.getPath());store.syncBirthDirectory(directory);return null;}finally{Arrays.fill(actual,(byte)0);}});completed=true;}
        synchronized void retainUnknown() throws Exception {require(!closed);store.locked(directory->{File file=store.appearancePending(directory);if(!file.exists())store.exclusiveAppearanceMarker(directory,marker,()->{});store.closed=true;return null;});}
        public synchronized void close(){closed=true;Arrays.fill(marker,(byte)0);}
    }
    AppearanceCompletion appearanceComplete(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId) throws Exception {
        final AppearanceCompletion[] retained=new AppearanceCompletion[1];
        try{return locked(directory->{admission.check();try(State state=read(directory)){admittedLive(admission,lease,state);validateAppearance(state);admission.appearanceCommandJoined(commandId);AppearanceEntry entry=state.appearances.get(lease.scope.profileId);require(entry!=null);File marker=appearancePending(directory);byte[] actual=boundedRegular(marker,4096),expected=appearanceMarkerBytes(admission,lease,commandId,entry.revision,entry.selection);
            try{require(MessageDigest.isEqual(actual,expected));retained[0]=new AppearanceCompletion(this,expected);admission.check();return retained[0];}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}
        }});}catch(Throwable failure){if(retained[0]!=null){try{retained[0].retainUnknown();}catch(Throwable sticky){failure.addSuppressed(sticky);}finally{retained[0].close();}}closed=true;if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}
    }
    private static void fixtureAppearanceContext(Context context) throws Exception {require(context!=null&&"ru.probpera.literaryplanet.dev".equals(context.getPackageName())&&(context.getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0);}
    static PlanetChildAppearance.Selection fixtureAppearanceSelection(String suffix) throws Exception {return new PlanetChildAppearance.Selection("fixture-scene-"+suffix,new PlanetChildAppearance.Owner("writer","fixture-writer"),new PlanetChildAppearance.Slot("fixture-skin-"+suffix,"fixture-skin-entity"),new PlanetChildAppearance.Geometry("stand.base.child-book-cloud","fixture-stand","fixture-stand-entity"),new PlanetChildAppearance.Geometry("background.base.library","fixture-background","fixture-background-entity"));}
    private static State fixtureAppearanceState() throws Exception {State state=new State();String hash="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";state.nonce="11111111111111111111111111111111";state.admissionBinding=hash;state.sdkCollections=true;for(String id:Arrays.asList("fixture-reader-one","fixture-reader-two")){Scope scope=new Scope(id,1,7,"ru","fixture-policy",hash,"fixture-package",1,hash);state.seals.put(id,new Seal(scope,hash));if("fixture-reader-two".equals(id)){byte[] history=new JSONObject().put("schemaVersion",1).put("scope",fixtureSDKScope(scope)).put("references",new JSONArray()).toString().getBytes(StandardCharsets.UTF_8);state.entries.put(Purpose.history.name()+"\n"+scope.key(Purpose.history),new Stored(7,history));state.collectionRevisions.put(collectionId(scope,Purpose.history),9L);}}return state;}
    /** Exact production codec/CAS, synthetic bytes only; never a permit. */
    static boolean fixtureAppearanceScenario(Context context,String name) throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("legacy","cas","isolation","tombstone","migration","corrupt").contains(name));
        if("legacy".equals(name)){try(State state=new State()){state.nonce="11111111111111111111111111111111";byte[] before=encode(state);try(State actual=decode(before)){byte[] after=encode(actual);try{require(!actual.sdkAppearance&&actual.appearances.isEmpty()&&MessageDigest.isEqual(before,after));}finally{Arrays.fill(after,(byte)0);}}finally{Arrays.fill(before,(byte)0);}}return true;}
        if("cas".equals(name)){require(appearanceNext(7,7)==8);boolean stale=false,overflow=false;try{appearanceNext(7,6);}catch(Exception deny){stale=true;}try{appearanceNext(MAX_SAFE-1,MAX_SAFE-1);}catch(Exception deny){overflow=true;}require(stale&&overflow);return true;}
        try(State state=fixtureAppearanceState()){byte[] legacy=encode(state);try{state.sdkAppearance=true;PlanetChildAppearance.Selection first=fixtureAppearanceSelection("one"),second=fixtureAppearanceSelection("two");state.appearances.put("fixture-reader-one",new AppearanceEntry(3,first));state.appearances.put("fixture-reader-two",new AppearanceEntry(9,second));if("tombstone".equals(name))state.appearances.put("fixture-reader-one",new AppearanceEntry(4,null));
            if("migration".equals(name)){String hash="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";Scope scope=new Scope("fixture-reader-one",2,7,"en","fixture-policy",hash,"fixture-package-en",2,hash);state.seals.put(scope.profileId,new Seal(scope,hash));state.admissionBinding=hash;migrateAppearance(state);require(state.appearances.get(scope.profileId).revision==3&&first.equals(state.appearances.get(scope.profileId).selection)&&state.appearances.get("fixture-reader-two").revision==9&&second.equals(state.appearances.get("fixture-reader-two").selection));}
            byte[] bytes=encode(state);try{if("corrupt".equals(name)){for(int kind=0;kind<3;kind++){byte[] changed=kind==2?Arrays.copyOf(bytes,bytes.length+1):bytes.clone();if(kind==0)changed[legacy.length+4]=2;if(kind==1)changed[legacy.length+5]=5;boolean deny=false;try(State ignored=decode(changed)){}catch(Exception failure){deny=true;}finally{Arrays.fill(changed,(byte)0);}require(deny);}return true;}
                try(State actual=decode(bytes)){byte[] exact=encode(actual);try{require(MessageDigest.isEqual(bytes,exact)&&actual.appearances.get("fixture-reader-two").revision==9&&second.equals(actual.appearances.get("fixture-reader-two").selection));AppearanceEntry one=actual.appearances.get("fixture-reader-one");require("tombstone".equals(name)?one.revision==4&&one.selection==null:one.revision==3&&first.equals(one.selection));if(!"migration".equals(name))require(MessageDigest.isEqual(legacy,Arrays.copyOf(bytes,legacy.length)));}finally{Arrays.fill(exact,(byte)0);}}
            }finally{Arrays.fill(bytes,(byte)0);}return true;
        }finally{Arrays.fill(legacy,(byte)0);}}
    }
    /** Real AES/AtomicFile persistence in an explicit owned synthetic run only. */
    static boolean fixtureAppearancePersistence(Context context,String runId,String phase) throws Exception {
        fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}"));PlanetChildDataStore store="write".equals(phase)?synthetic(context,runId):new PlanetChildDataStore(context,runId,true);return store.locked(directory->{if(!"write".equals(phase))store.existingRecord(directory);
            if("write".equals(phase)){try(State state=fixtureAppearanceState()){state.sdkAppearance=true;state.appearances.put("fixture-reader-one",new AppearanceEntry(5,fixtureAppearanceSelection("one")));state.appearances.put("fixture-reader-two",new AppearanceEntry(11,fixtureAppearanceSelection("two")));store.write(directory,state,()->{});return true;}}
            try(State state=store.read(directory)){if("read".equals(phase)){require(state.appearances.get("fixture-reader-one").revision==5&&fixtureAppearanceSelection("one").equals(state.appearances.get("fixture-reader-one").selection)&&state.appearances.get("fixture-reader-two").revision==11&&fixtureAppearanceSelection("two").equals(state.appearances.get("fixture-reader-two").selection));return true;}
                if("pending".equals(phase)){byte[] marker=("LP-SOFTWARE-APPEARANCE-PENDING\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);try{store.exclusiveAppearanceMarker(directory,marker,()->{});}finally{Arrays.fill(marker,(byte)0);}}
                require(Arrays.asList("pending","pending-reopen").contains(phase)&&store.appearancePending(directory).isFile());boolean denied=false;try{require(!store.appearancePending(directory).exists());}catch(Exception closed){denied=true;}require(denied);return true;}
        });
    }
    static boolean fixtureAppearanceMissingDoesNotSeed(Context context,String runId) throws Exception {
        fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}"));String name="literary-planet-child-data-v1-synthetic-"+runId;File directory=new File(context.getNoBackupFilesDir().getCanonicalFile(),name);require(directory.getAbsoluteFile().equals(directory.getCanonicalFile())&&!directory.exists());
        boolean denied=false;try{PlanetChildDataStore store=new PlanetChildDataStore(context,runId,true);store.locked(owned->{store.existingRecord(owned);return null;});}catch(Exception unavailable){denied=true;}require(denied);File encrypted=new File(directory,"snapshot-v1");KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);require(!encrypted.exists()&&!keys.containsAlias(context.getPackageName()+"."+name+".aes"));return true;
    }
    static boolean fixtureProductionAppearancePending(Context context,String commandId) throws Exception {
        fixtureAppearanceContext(context);require(commandId!=null&&commandId.matches("[a-f0-9]{32}"));File root=new File(context.getNoBackupFilesDir().getCanonicalFile(),"literary-planet-child-data-v1"),file=new File(root,"local-v2-appearance.pending");require(root.getAbsoluteFile().equals(root.getCanonicalFile())&&file.getAbsoluteFile().equals(file.getCanonicalFile()));StructStat info=Os.lstat(file.getPath());require(OsConstants.S_ISREG(info.st_mode)&&info.st_size>0&&info.st_size<=4096);byte[] bytes=new byte[(int)info.st_size];try(FileInputStream input=new FileInputStream(file)){int at=0;while(at<bytes.length){int count=input.read(bytes,at,bytes.length-at);require(count>0);at+=count;}require(input.read()==-1);String[] rows=utf8(bytes).split("\n",-1);return rows.length==10&&"LP-LOCAL-V2-APPEARANCE".equals(rows[0])&&commandId.equals(rows[2]);}finally{Arrays.fill(bytes,(byte)0);}
    }

    private static final class JourneyEntry {
        final long revision;final String activeJourneyId;final TreeMap<String,PlanetChildJourney.Progress> values;
        JourneyEntry(long revision,String activeJourneyId,Map<String,PlanetChildJourney.Progress> values){this.revision=revision;this.activeJourneyId=activeJourneyId;this.values=new TreeMap<>(values);}
    }
    static final class JourneyResult implements AutoCloseable {
        final String profileId,activeJourneyId;final long revision;final PlanetChildJourney.Progress progress;private boolean closed;
        private JourneyResult(String profileId,long revision,PlanetChildJourney.Progress progress,String activeJourneyId){this.profileId=profileId;this.revision=revision;this.progress=progress;this.activeJourneyId=activeJourneyId;}
        synchronized Map<String,Object> dto() throws Exception {require(!closed);Map<String,Object> out=new LinkedHashMap<>();out.put("profileId",profileId);out.put("revision",revision);out.put("progress",progress==null?null:progress.dto());return Collections.unmodifiableMap(out);}
        synchronized boolean closedForSDK(){return closed;}public synchronized void close(){closed=true;}
    }
    private static void validateJourney(State state) throws Exception {
        if(!state.sdkJourney){require(state.journeys.isEmpty());return;}
        require(state.sdkCollections&&state.sdkAppearance&&state.admissionBinding!=null&&state.sdkUnboundBirth==null&&state.journeys.size()<=4&&state.seals.keySet().containsAll(state.journeys.keySet()));
        for(Map.Entry<String,JourneyEntry> row:state.journeys.entrySet()){JourneyEntry entry=row.getValue();require(identifier(row.getKey())&&entry.revision>0&&identifier(entry.activeJourneyId)&&entry.values.size()>0&&entry.values.size()<=32&&entry.values.containsKey(entry.activeJourneyId));PlanetChildAppearance.revision(entry.revision);
            for(Map.Entry<String,PlanetChildJourney.Progress> journey:entry.values.entrySet()){require(journey.getKey().equals(journey.getValue().journeyId));byte[] bytes=journey.getValue().encode();try{require(PlanetChildJourney.decode(bytes).equals(journey.getValue()));}finally{Arrays.fill(bytes,(byte)0);}}
        }
    }
    private static void encodeJourney(State state,DataOutputStream out) throws Exception {
        validateJourney(state);if(!state.sdkJourney)return;out.writeInt(0x4c504a32);out.writeByte(1);out.writeByte(state.journeys.size());
        for(Map.Entry<String,JourneyEntry> row:state.journeys.entrySet()){out.writeUTF(row.getKey());JourneyEntry entry=row.getValue();out.writeLong(entry.revision);out.writeUTF(entry.activeJourneyId);out.writeByte(entry.values.size());for(PlanetChildJourney.Progress progress:entry.values.values()){byte[] bytes=progress.encode();try{out.writeInt(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}}
    }
    private static void decodeJourney(State state,DataInputStream in) throws Exception {
        require(in.readInt()==0x4c504a32&&in.readUnsignedByte()==1&&state.sdkAppearance);state.sdkJourney=true;int count=in.readUnsignedByte();require(count<=4);
        for(int i=0;i<count;i++){String profile=in.readUTF();long revision=in.readLong();String active=in.readUTF();int n=in.readUnsignedByte();require(n>0&&n<=32&&!state.journeys.containsKey(profile));TreeMap<String,PlanetChildJourney.Progress> values=new TreeMap<>();for(int j=0;j<n;j++){int length=in.readInt();require(length>0&&length<=PlanetChildJourney.MAX_BYTES&&length<=in.available());byte[] bytes=new byte[length];try{in.readFully(bytes);PlanetChildJourney.Progress progress=PlanetChildJourney.decode(bytes);require(!values.containsKey(progress.journeyId));values.put(progress.journeyId,progress);}finally{Arrays.fill(bytes,(byte)0);}}state.journeys.put(profile,new JourneyEntry(revision,active,values));}validateJourney(state);
    }
    private static long journeyNext(long current,long expected) throws Exception {require(current==expected);return PlanetChildAppearance.next(current);}
    /** Validate the complete proposed snapshot before any durable marker/write.
     * A known count/size refusal must not strand an otherwise valid store. */
    private static void prepareJourneyWrite(State state,String profile,long revision,PlanetChildJourney.Progress progress) throws Exception {
        JourneyEntry prior=state.journeys.get(profile);TreeMap<String,PlanetChildJourney.Progress> retained=prior==null?new TreeMap<>():new TreeMap<>(prior.values);
        retained.put(progress.journeyId,progress);require(retained.size()<=32);
        state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.journeys.put(profile,new JourneyEntry(revision,progress.journeyId,retained));
        byte[] bounded=encode(state);try{validateJourney(state);}finally{Arrays.fill(bounded,(byte)0);}
    }
    private static void migrateJourney(State state) throws Exception {validateJourney(state);require(sealBindings(state).keySet().containsAll(state.journeys.keySet()));}
    private File journeyPending(File directory) throws Exception {File file=new File(directory,"local-v2-journey.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void exclusiveJourneyMarker(File directory,byte[] marker,Check check) throws Exception {
        require(marker!=null&&marker.length>0&&marker.length<=4096);FileDescriptor fd=Os.open(journeyPending(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
        try{int at=0;while(at<marker.length){check.check();int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);
    }
    private byte[] journeyMarkerBytes(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId,long revision,PlanetChildJourney.Progress progress) throws Exception {
        byte[] bytes=progress.encode();try{return ("LP-LOCAL-V2-JOURNEY\n"+identity+"\n"+commandId+"\n"+admission.binding()+"\n"+lease.scope.profileId+"\n"+lease.generation+"\n"+lease.nonce+"\n"+revision+"\n"+digest(bytes)+"\n").getBytes(StandardCharsets.US_ASCII);}finally{Arrays.fill(bytes,(byte)0);}
    }
    JourneyResult admittedJourney(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Long expected,PlanetChildVault.LocalV2JourneyProgressPermit permit,String commandId,String requestedJourneyId) throws Exception {
        require(admission!=null&&lease!=null&&(expected==null)==(permit==null)&&commandId!=null&&commandId.matches("[a-f0-9]{32}"));
        return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);validateJourney(state);String profile=lease.scope.profileId;JourneyEntry prior=state.journeys.get(profile);long revision=prior==null?0:prior.revision;PlanetChildJourney.Progress priorProgress=prior==null?null:prior.values.get(requestedJourneyId==null?prior.activeJourneyId:requestedJourneyId);
            if(permit==null){JourneyResult result=new JourneyResult(profile,revision,priorProgress,prior==null?null:prior.activeJourneyId);try{admission.check();return result;}catch(Exception failure){result.close();throw failure;}}
            long next=journeyNext(revision,expected);PlanetChildJourney.Progress progress=permit.progress(admission);require(profile.equals(permit.profileId(admission)));prepareJourneyWrite(state,profile,next,progress);PlanetChildPassport.Credit credit=permit.learningCredit(admission);PlanetChildPassport.CompletedJourney completedJourney=permit.completedJourney(admission);if(credit!=null||completedJourney!=null){PassportEntry priorPassport=state.passports.get(profile);PlanetChildPassport.Ledger beforePassport=priorPassport==null?PlanetChildPassport.empty():priorPassport.ledger;PlanetChildPassport.Ledger learned=beforePassport.learned(credit).finished(completedJourney);learned=permit.awarded(admission,learned);if(!learned.equals(beforePassport))preparePassportWrite(state,profile,PlanetChildAppearance.next(priorPassport==null?0:priorPassport.revision),learned);}byte[] marker=journeyMarkerBytes(admission,lease,commandId,next,progress);boolean markerAttempted=false;
            try{markerAttempted=true;exclusiveJourneyMarker(directory,marker,()->permit.check(admission));write(directory,state,()->permit.check(admission));
                try(State actual=read(directory)){admittedLive(admission,lease,actual);permit.check(admission);JourneyEntry saved=actual.journeys.get(profile);require(saved!=null&&saved.revision==next&&progress.journeyId.equals(saved.activeJourneyId)&&progress.equals(saved.values.get(progress.journeyId)));byte[] before=encode(state),after=encode(actual);try{require(MessageDigest.isEqual(before,after));}finally{Arrays.fill(before,(byte)0);Arrays.fill(after,(byte)0);}}
                byte[] pending=boundedRegular(journeyPending(directory),4096);try{require(MessageDigest.isEqual(pending,marker));}finally{Arrays.fill(pending,(byte)0);}admission.journeyCommandKnown(commandId);JourneyResult result=new JourneyResult(profile,next,progress,progress.journeyId);try{admission.journeyCommandReady(commandId);return result;}catch(Exception failure){result.close();throw failure;}
            }catch(Throwable failure){if(markerAttempted){closed=true;}if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}finally{Arrays.fill(marker,(byte)0);}
        }});
    }
    /** Capture keeps the durable marker until the actual SDK command is done,
     * its native consumer owns the result, and all final admission fences pass.
     * Observed completion/callback failure retains DENY, never rollback.
     * No caller can construct, acknowledge or supply the receipt bytes. */
    static final class JourneyCompletion implements AutoCloseable {
        private final PlanetChildDataStore store;private final byte[] marker;private boolean closed,completed;
        private JourneyCompletion(PlanetChildDataStore store,byte[] marker){this.store=store;this.marker=marker.clone();}
        synchronized void complete() throws Exception {require(!closed&&!completed);store.locked(directory->{require(!store.closed);File file=store.journeyPending(directory);byte[] actual=store.boundedRegular(file,4096);try{require(MessageDigest.isEqual(actual,marker));Os.remove(file.getPath());store.syncBirthDirectory(directory);return null;}finally{Arrays.fill(actual,(byte)0);}});completed=true;}
        synchronized void retainUnknown() throws Exception {require(!closed);store.locked(directory->{File file=store.journeyPending(directory);if(!file.exists())store.exclusiveJourneyMarker(directory,marker,()->{});store.closed=true;return null;});}
        public synchronized void close(){closed=true;Arrays.fill(marker,(byte)0);}
    }
    JourneyCompletion journeyComplete(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId) throws Exception {
        final JourneyCompletion[] retained=new JourneyCompletion[1];
        try{return locked(directory->{admission.check();try(State state=read(directory)){admittedLive(admission,lease,state);validateJourney(state);admission.journeyCommandJoined(commandId);JourneyEntry entry=state.journeys.get(lease.scope.profileId);require(entry!=null&&entry.values.get(entry.activeJourneyId)!=null);File marker=journeyPending(directory);byte[] actual=boundedRegular(marker,4096),expected=journeyMarkerBytes(admission,lease,commandId,entry.revision,entry.values.get(entry.activeJourneyId));
            try{require(MessageDigest.isEqual(actual,expected));retained[0]=new JourneyCompletion(this,expected);admission.check();return retained[0];}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}
        }});}catch(Throwable failure){if(retained[0]!=null){try{retained[0].retainUnknown();}catch(Throwable sticky){failure.addSuppressed(sticky);}finally{retained[0].close();}}closed=true;if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}
    }

    static PlanetChildJourney.Progress fixtureJourneyProgress(String id,String current,List<String> completed) throws Exception {return new PlanetChildJourney.Progress(id,1,1,current,completed,"fixture-country",null,null,"journey");}
    /** Production snapshot codec/CAS with explicit software fixture values. */
    static boolean fixtureJourneyScenario(Context context,String name) throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("legacy","cas","isolation","archive","migration","corrupt","capacity").contains(name));
        if("cas".equals(name)){require(journeyNext(7,7)==8);boolean stale=false,overflow=false;try{journeyNext(7,6);}catch(Exception deny){stale=true;}try{journeyNext(MAX_SAFE-1,MAX_SAFE-1);}catch(Exception deny){overflow=true;}require(stale&&overflow);return true;}
        if("capacity".equals(name)){try(State state=fixtureAppearanceState()){
            TreeMap<String,PlanetChildJourney.Progress> values=new TreeMap<>();for(int i=0;i<32;i++){PlanetChildJourney.Progress item=fixtureJourneyProgress("retained-journey-"+i,"fixture-node",Arrays.asList("archived-node"));values.put(item.journeyId,item);}
            state.sdkAppearance=true;state.sdkJourney=true;state.journeys.put("fixture-reader-one",new JourneyEntry(32,"retained-journey-0",values));
            byte[] before=encode(state);try{boolean refused=false;try{prepareJourneyWrite(state,"fixture-reader-one",33,fixtureJourneyProgress("new-journey","fixture-node",Collections.emptyList()));}catch(Exception full){refused=true;}require(refused);
                byte[] unchanged=encode(state);try{require(MessageDigest.isEqual(before,unchanged));}finally{Arrays.fill(unchanged,(byte)0);}
                PlanetChildJourney.Progress replacement=fixtureJourneyProgress("retained-journey-0","fixture-next",Arrays.asList("archived-node","fixture-node"));prepareJourneyWrite(state,"fixture-reader-one",33,replacement);JourneyEntry entry=state.journeys.get("fixture-reader-one");require(entry.revision==33&&entry.values.size()==32&&replacement.equals(entry.values.get(replacement.journeyId)));for(Map.Entry<String,PlanetChildJourney.Progress> prior:values.entrySet())if(!prior.getKey().equals(replacement.journeyId))require(prior.getValue().equals(entry.values.get(prior.getKey())));
            }finally{Arrays.fill(before,(byte)0);}return true;
        }}
        try(State state=fixtureAppearanceState()){byte[] legacy=encode(state);try{if("legacy".equals(name)){try(State actual=decode(legacy)){byte[] exact=encode(actual);try{require(!actual.sdkJourney&&actual.journeys.isEmpty()&&MessageDigest.isEqual(legacy,exact));}finally{Arrays.fill(exact,(byte)0);}}return true;}
            state.sdkAppearance=true;state.sdkJourney=true;PlanetChildJourney.Progress first=fixtureJourneyProgress("fixture-journey-one","fixture-node-two",Arrays.asList("fixture-node-one")),archived=fixtureJourneyProgress("fixture-journey-archived",null,Arrays.asList("fixture-node-old")),second=fixtureJourneyProgress("fixture-journey-two","fixture-node-four",Collections.emptyList());
            TreeMap<String,PlanetChildJourney.Progress> retained=new TreeMap<>();retained.put(first.journeyId,first);retained.put(archived.journeyId,archived);state.journeys.put("fixture-reader-one",new JourneyEntry(3,first.journeyId,retained));state.journeys.put("fixture-reader-two",new JourneyEntry(9,second.journeyId,Collections.singletonMap(second.journeyId,second)));
            if("archive".equals(name))state.journeys.put("fixture-reader-one",new JourneyEntry(4,archived.journeyId,retained));
            if("migration".equals(name)){String hash="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";Scope scope=new Scope("fixture-reader-one",2,7,"en","fixture-policy",hash,"fixture-package-en",2,hash);state.seals.put(scope.profileId,new Seal(scope,hash));state.admissionBinding=hash;migrateJourney(state);require(state.journeys.get(scope.profileId).values.get(first.journeyId).equals(first));}
            byte[] bytes=encode(state);try{if("corrupt".equals(name)){for(int n=0;n<3;n++){byte[] changed=n==0?Arrays.copyOf(bytes,bytes.length+1):bytes.clone();if(n==1)changed[changed.length-1]=2;if(n==2)changed[changed.length-1]=(byte)255;boolean deny=false;try(State ignored=decode(changed)){}catch(Exception failure){deny=true;}finally{Arrays.fill(changed,(byte)0);}require(deny);}return true;}
                try(State actual=decode(bytes)){byte[] exact=encode(actual);try{require(MessageDigest.isEqual(bytes,exact)&&actual.journeys.get("fixture-reader-two").revision==9&&second.equals(actual.journeys.get("fixture-reader-two").values.get(second.journeyId)));JourneyEntry one=actual.journeys.get("fixture-reader-one");require(one.values.size()==2&&first.equals(one.values.get(first.journeyId))&&archived.equals(one.values.get(archived.journeyId))&&("archive".equals(name)?one.revision==4&&one.activeJourneyId.equals(archived.journeyId):one.revision==3&&one.activeJourneyId.equals(first.journeyId)));}finally{Arrays.fill(exact,(byte)0);}}
            }finally{Arrays.fill(bytes,(byte)0);}return true;
        }finally{Arrays.fill(legacy,(byte)0);}}
    }
    static boolean fixtureJourneyPersistence(Context context,String runId,String phase) throws Exception {
        fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}")&&Arrays.asList("write","read","pending","pending-reopen").contains(phase));PlanetChildDataStore store="write".equals(phase)?synthetic(context,runId):new PlanetChildDataStore(context,runId,true);return store.locked(directory->{if(!"write".equals(phase))store.existingRecord(directory);
            if("write".equals(phase)){try(State state=fixtureAppearanceState()){state.sdkAppearance=true;state.sdkJourney=true;PlanetChildJourney.Progress one=fixtureJourneyProgress("fixture-journey-one","fixture-node-two",Arrays.asList("fixture-node-one")),two=fixtureJourneyProgress("fixture-journey-two","fixture-node-four",Collections.emptyList());state.journeys.put("fixture-reader-one",new JourneyEntry(5,one.journeyId,Collections.singletonMap(one.journeyId,one)));state.journeys.put("fixture-reader-two",new JourneyEntry(11,two.journeyId,Collections.singletonMap(two.journeyId,two)));store.write(directory,state,()->{});return true;}}
            try(State state=store.read(directory)){require(state.journeys.get("fixture-reader-one").revision==5&&state.journeys.get("fixture-reader-one").values.get("fixture-journey-one").completedNodeIds.equals(Arrays.asList("fixture-node-one"))&&state.journeys.get("fixture-reader-two").revision==11);if("read".equals(phase)){store.noPendingOperations(directory);return true;}
                if("pending".equals(phase)){store.noPendingOperations(directory);byte[] marker=("LP-SOFTWARE-JOURNEY-PENDING\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);try{store.exclusiveJourneyMarker(directory,marker,()->{});}finally{Arrays.fill(marker,(byte)0);}}require(store.journeyPending(directory).isFile());boolean denied=false;try{store.noPendingOperations(directory);}catch(Exception closed){denied=true;}require(denied);return true;}
        });
    }

    private File downloadRecovery(File directory)throws Exception {File file=new File(directory,"route-stage-recovery-v1");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private byte[] downloadRecoveryAAD(){return (identity+"\nLP-CHILD-STAGE-RECOVERY-v1").getBytes(StandardCharsets.US_ASCII);}
    private byte[] readDownloadRecovery(File directory)throws Exception {
        byte[] encoded=boundedRegular(downloadRecovery(directory),2048),plain=null;boolean kept=false;
        try{require(encoded.length>=30&&encoded[0]==1);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(false,directory),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13)));cipher.updateAAD(downloadRecoveryAAD());plain=cipher.doFinal(encoded,13,encoded.length-13);downloadRecoveryFields(plain);kept=true;return plain;}finally{Arrays.fill(encoded,(byte)0);if(!kept&&plain!=null)Arrays.fill(plain,(byte)0);}
    }
    private static String[] downloadRecoveryFields(byte[] plain)throws Exception {
        String text=utf8(plain);String[] fields=text.split("\n",-1);require(fields.length==8&&"LP-CHILD-STAGE-RECOVERY-v1".equals(fields[0])&&fields[7].isEmpty()&&fields[5].matches("[a-f0-9]{32}"));for(int index:new int[]{1,2,3,4,6})require(checksum(fields[index]));return fields;
    }
    private static byte[] retiredDownloadState(byte[] plain,String nextNonce)throws Exception {try(State state=decode(plain)){require(state.scope!=null&&state.generation<MAX_SAFE-1);state.scope=null;state.generation++;state.nonce=nextNonce;return encode(state);}}
    /** Recovery is only for a staged write. Exact whole snapshots and its original
     * marker are authenticated before the primary AtomicFile can be touched. */
    private void writeDownloadRecovery(File directory,byte[] before,State after,byte[] marker,Check check)throws Exception {
        require(after.scope!=null&&after.downloads.present&&!after.downloads.checkpointTerminal&&after.scope.profileId.equals(after.downloads.checkpointProfile)&&after.downloads.stages.values().stream().anyMatch(stage->stage.profileId.equals(after.scope.profileId))&&!downloadRecovery(directory).exists());
        String nextNonce=nonce();byte[] next=encode(after),retiredBefore=null,retiredAfter=null,plain=null,encrypted=null,encoded=null;
        try{retiredBefore=retiredDownloadState(before,nextNonce);retiredAfter=retiredDownloadState(next,nextNonce);plain=("LP-CHILD-STAGE-RECOVERY-v1\n"+digest(before)+"\n"+digest(next)+"\n"+digest(retiredBefore)+"\n"+digest(retiredAfter)+"\n"+nextNonce+"\n"+digest(marker)+"\n").getBytes(StandardCharsets.US_ASCII);downloadRecoveryFields(plain);check.check();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(false,directory));byte[] iv=cipher.getIV();require(iv.length==12);cipher.updateAAD(downloadRecoveryAAD());encrypted=cipher.doFinal(plain);encoded=ByteBuffer.allocate(encrypted.length+13).put((byte)1).put(iv).put(encrypted).array();
            FileDescriptor fd=Os.open(downloadRecovery(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);try(FileOutputStream out=new FileOutputStream(fd)){out.write(encoded);out.getFD().sync();}syncBirthDirectory(directory);byte[] actual=readDownloadRecovery(directory);try{require(MessageDigest.isEqual(actual,plain));check.check();}finally{Arrays.fill(actual,(byte)0);}
        }finally{Arrays.fill(next,(byte)0);for(byte[] bytes:new byte[][]{retiredBefore,retiredAfter,plain,encrypted,encoded})if(bytes!=null)Arrays.fill(bytes,(byte)0);}
    }
    private State readIntactDownloadPrimary(File directory)throws Exception {
        AtomicFile file=record(directory);require(file.getBaseFile().isFile()&&!new File(file.getBaseFile()+".bak").exists());byte[] encoded=boundedRegular(file.getBaseFile(),MAX_SNAPSHOT_BYTES+29),plain=null;
        try{require(encoded.length>=30&&encoded[0]==1);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(false,directory),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13)));cipher.updateAAD(identity.getBytes(StandardCharsets.UTF_8));plain=cipher.doFinal(encoded,13,encoded.length-13);return decode(plain);}finally{Arrays.fill(encoded,(byte)0);if(plain!=null)Arrays.fill(plain,(byte)0);}
    }
    private interface DownloadRecoveryCurrent {void check(State state)throws Exception;}
    private void verifyDownloadRecoveryObjects(File directory,State state,Check check)throws Exception {
        for(PlanetChildRouteDownload.ObjectRef ref:state.downloads.objects.values()){byte[] bytes=readDownloadObject(directory,ref,check);try{check.check();}finally{Arrays.fill(bytes,(byte)0);}}
    }
    private void recoverDownloadStaging(File directory,PlanetChildVault.LocalV2SDKReadPermit permit)throws Exception {
        permit.check();recoverDownloadStaging(directory,permit::check,state->{require(state.pendingMigration==null&&state.admissionBinding!=null&&state.admissionBinding.equals(permit.binding())&&sealBindings(state).equals(permit.profiles()));byte[] plain=knownPlain(directory),claim=null;try{PlanetChildVault.LocalV2KnownBirth birth=permit.knownBirth(identity,plain);claim=boundedRegular(birthMarker(directory),4096);require(digest(claim).equals(birth.claimChecksum));}finally{Arrays.fill(plain,(byte)0);if(claim!=null)Arrays.fill(claim,(byte)0);}});
    }
    private void recoverDownloadStaging(File directory,Check check,DownloadRecoveryCurrent current)throws Exception {
        if(!downloadRecovery(directory).exists())return;check.check();noPendingExceptDownload(directory);byte[] receipt=readDownloadRecovery(directory);
        try(State state=readIntactDownloadPrimary(directory)){String[] fields=downloadRecoveryFields(receipt);current.check(state);byte[] plain=encode(state);boolean before,after,retired;try{String hash=digest(plain);before=fields[1].equals(hash);after=fields[2].equals(hash);retired=fields[3].equals(hash)||fields[4].equals(hash);require(before||after||retired);require(retired?state.scope==null:state.scope!=null);if(after)require(state.downloads.present&&!state.downloads.checkpointTerminal);}finally{Arrays.fill(plain,(byte)0);}
            if(passportPending(directory).exists()){byte[] marker=boundedRegular(passportPending(directory),4096);try{require(fields[6].equals(digest(marker)));}finally{Arrays.fill(marker,(byte)0);}}
            verifyDownloadRecoveryObjects(directory,state,check);check.check();File partial=new File(record(directory).getBaseFile()+".new");if(partial.exists()){require(partial.getAbsoluteFile().equals(partial.getCanonicalFile()));StructStat stat=Os.lstat(partial.getPath());require(OsConstants.S_ISREG(stat.st_mode)&&stat.st_size>=0&&stat.st_size<=MAX_SNAPSHOT_BYTES+29);Os.remove(partial.getPath());syncBirthDirectory(directory);}
            if(!retired){require(state.generation<MAX_SAFE-1);state.scope=null;state.generation++;state.nonce=fields[5];check.check();write(directory,state,check);}
            check.check();if(passportPending(directory).exists()){Os.remove(passportPending(directory).getPath());syncBirthDirectory(directory);}check.check();Os.remove(downloadRecovery(directory).getPath());syncBirthDirectory(directory);check.check();
        }finally{Arrays.fill(receipt,(byte)0);}
    }

    /** Only current genuine original SDK inspection can retire a stale scope.
     * This is data re-anchoring, not trusted time/PIN/anti-rollback authority.
     * Uncertain final activation and every legacy operation marker still deny. */
    private void noPendingExceptDownload(File directory)throws Exception {require(!migrationPending(directory).exists()&&!knownPending(directory).exists()&&!collectionPending(directory).exists()&&!appearancePending(directory).exists()&&!journeyPending(directory).exists());}
    private void reanchorDownloadCheckpoint(File directory,State state,PlanetChildVault.LocalV2SDKReadPermit permit)throws Exception {
        boolean pending=passportPending(directory).exists();if(state.scope==null){require(!pending);return;}permit.check();validateDownloads(state);require(state.downloads.present&&state.downloads.checkpointProfile!=null&&state.scope.profileId.equals(state.downloads.checkpointProfile)&&state.admissionBinding.equals(permit.binding())&&sealBindings(state).equals(permit.profiles()));
        PassportEntry checkpoint=state.passports.get(state.downloads.checkpointProfile);require(checkpoint!=null&&checkpoint.revision==state.downloads.checkpointRevision);byte[] ledger=checkpoint.ledger.encode();try{require(digest(ledger).equals(state.downloads.checkpointLedger));}finally{Arrays.fill(ledger,(byte)0);}
        if(pending){require(!state.downloads.checkpointTerminal&&state.downloads.stages.values().stream().anyMatch(stage->stage.profileId.equals(state.scope.profileId)));byte[] actual=boundedRegular(passportPending(directory),4096),expected=null;try{String[] lines=new String(actual,StandardCharsets.US_ASCII).split("\n",-1);require(lines.length==11&&lines[0].equals("LP-LOCAL-V2-PASSPORT")&&lines[2].matches("[a-f0-9]{32}"));expected=("LP-LOCAL-V2-PASSPORT\n"+identity+"\n"+lines[2]+"\n"+state.admissionBinding+"\n"+state.scope.profileId+"\n"+state.generation+"\n"+state.nonce+"\n"+checkpoint.revision+"\n"+state.downloads.checkpointLedger+"\n"+downloadDigest(state)+"\n").getBytes(StandardCharsets.US_ASCII);require(MessageDigest.isEqual(actual,expected));}finally{Arrays.fill(actual,(byte)0);if(expected!=null)Arrays.fill(expected,(byte)0);}}
        // Verify every completed prefix object before acknowledging the staged
        // data. Fresh locale policy is re-evaluated later by resume, never here.
        for(PlanetChildRouteDownload.Stage stage:state.downloads.stages.values())if(stage.profileId.equals(state.scope.profileId)){List<PlanetChildRouteDownload.ObjectRef> refs=stage.objects();for(int i=0;i<stage.completed;i++){byte[] bytes=readDownloadObject(directory,refs.get(i),permit::check);try{PlanetChildVault.checkSharedPassportObject(stage.route,i,bytes);}finally{Arrays.fill(bytes,(byte)0);}}}
        if(state.downloads.checkpointTerminal)for(PlanetChildPassport.Route route:checkpoint.ledger.routes)if(PlanetChildVault.sharedPassportRoute(route)){List<PlanetChildRouteDownload.ObjectRef> refs=PlanetChildVault.sharedPassportRouteObjects(state.scope.profileId,route);for(int i=0;i<refs.size();i++){byte[] bytes=readDownloadObject(directory,refs.get(i),permit::check);try{PlanetChildVault.checkSharedPassportObject(route,i,bytes);}finally{Arrays.fill(bytes,(byte)0);}}}
        // Remove only an exact proven stage marker. A crash before retirement
        // keeps the original scope and authenticated checkpoint recoverable.
        if(pending){permit.check();Os.remove(passportPending(directory).getPath());syncBirthDirectory(directory);}require(state.generation<MAX_SAFE-1);state.scope=null;state.generation++;state.nonce=nonce();write(directory,state,permit::check);permit.check();
    }

    // The optional tail is authenticated by the SAME encrypted snapshot/CAS and
    // passport marker. Blob files are unreadable without a live catalog entry.
    private static void validateDownloads(State state)throws Exception {
        state.downloads.validate();if(!state.downloads.present){require(state.downloads.objects.isEmpty()&&state.downloads.stages.isEmpty());}
        for(PlanetChildRouteDownload.ObjectRef ref:state.downloads.objects.values())require(state.seals.containsKey(ref.profileId));
        for(PlanetChildRouteDownload.Stage stage:state.downloads.stages.values())require(state.sdkPassport&&state.passports.containsKey(stage.profileId)&&state.seals.containsKey(stage.profileId));
        for(Map.Entry<String,PassportEntry> row:state.passports.entrySet())for(PlanetChildPassport.Route route:row.getValue().ledger.routes)if(PlanetChildVault.sharedPassportRoute(route)){require(state.downloads.present);for(PlanetChildRouteDownload.ObjectRef ref:PlanetChildVault.sharedPassportRouteObjects(row.getKey(),route))require(ref.equals(state.downloads.objects.get(ref.key())));}
    }
    private static void encodeDownloads(State state,DataOutputStream out)throws Exception {validateDownloads(state);if(!state.downloads.present)return;byte[] bytes=state.downloads.encode();try{out.writeInt(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static void decodeDownloads(State state,DataInputStream in)throws Exception {int length=in.readInt();require(length>0&&length<=MAX_SNAPSHOT_BYTES&&length<=in.available());byte[] bytes=new byte[length];try{in.readFully(bytes);state.downloads.close();state.downloads=PlanetChildRouteDownload.Catalog.decode(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static String downloadDigest(State state)throws Exception {byte[] b=state.downloads.encode();try{return digest(b);}finally{Arrays.fill(b,(byte)0);}}
    private static void collectDownloadObjects(State state)throws Exception {
        Set<String> retained=new HashSet<>();for(PlanetChildRouteDownload.Stage stage:state.downloads.stages.values()){List<PlanetChildRouteDownload.ObjectRef> refs=stage.objects();for(int i=0;i<stage.completed;i++)retained.add(refs.get(i).key());}
        for(Map.Entry<String,PassportEntry> row:state.passports.entrySet())for(PlanetChildPassport.Route route:row.getValue().ledger.routes)if(PlanetChildVault.sharedPassportRoute(route))for(PlanetChildRouteDownload.ObjectRef ref:PlanetChildVault.sharedPassportRouteObjects(row.getKey(),route))retained.add(ref.key());state.downloads.objects.keySet().retainAll(retained);
    }
    private AtomicFile downloadObjectFile(File directory,PlanetChildRouteDownload.ObjectRef ref)throws Exception {String name="route-object-v1-"+digest(ref.profileId.getBytes(StandardCharsets.UTF_8))+"-"+digest(ref.key().getBytes(StandardCharsets.UTF_8));File path=new File(directory,name);require(path.getAbsoluteFile().equals(path.getCanonicalFile()));for(String suffix:new String[]{"",".new",".bak"}){File named=new File(path.getPath()+suffix);require(named.getAbsoluteFile().equals(named.getCanonicalFile()));try{StructStat stat=Os.lstat(named.getPath());require(OsConstants.S_ISREG(stat.st_mode)&&stat.st_size>=0&&stat.st_size<=ref.bytes+29);}catch(android.system.ErrnoException missing){require(missing.errno==OsConstants.ENOENT);}}return new AtomicFile(path);}
    private byte[] downloadObjectAAD(PlanetChildRouteDownload.ObjectRef ref){return (identity+"\nLP-CHILD-ROUTE-OBJECT\n"+ref.key()+"\n"+ref.bytes).getBytes(StandardCharsets.UTF_8);}
    private byte[] readDownloadObject(File directory,PlanetChildRouteDownload.ObjectRef ref,Check check)throws Exception {
        check.check();unlocked();AtomicFile file=downloadObjectFile(directory,ref);require(file.getBaseFile().exists()&&!new File(file.getBaseFile()+".bak").exists()&&!new File(file.getBaseFile()+".new").exists());byte[] encoded=boundedRegular(file.getBaseFile(),ref.bytes+29),plain=null;boolean kept=false;
        try{require(encoded.length==ref.bytes+29&&encoded[0]==1);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(false,directory),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13)));cipher.updateAAD(downloadObjectAAD(ref));plain=cipher.doFinal(encoded,13,encoded.length-13);PlanetChildResources.verifyEncoded(plain,ref.bytes,ref.checksum);PlanetChildModelImport.preflight(plain,ref.mime);check.check();kept=true;return plain;}finally{Arrays.fill(encoded,(byte)0);if(!kept&&plain!=null)Arrays.fill(plain,(byte)0);}
    }
    private void writeDownloadObject(File directory,PlanetChildRouteDownload.ObjectRef ref,byte[] bytes,Check check)throws Exception {
        PlanetChildResources.verifyEncoded(bytes,ref.bytes,ref.checksum);PlanetChildModelImport.preflight(bytes,ref.mime);AtomicFile file=downloadObjectFile(directory,ref);
        // Immutable content addresses may already be present after interruption.
        // Reuse requires full authenticated readback; never overwrite corruption.
        if(file.getBaseFile().exists()){byte[] prior=readDownloadObject(directory,ref,check);try{require(MessageDigest.isEqual(prior,bytes));}finally{Arrays.fill(prior,(byte)0);}return;}
        byte[] encoded=null,ciphertext=null;try{check.check();Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(false,directory));byte[] iv=cipher.getIV();require(iv.length==12);cipher.updateAAD(downloadObjectAAD(ref));ciphertext=cipher.doFinal(bytes);encoded=ByteBuffer.allocate(ciphertext.length+13).put((byte)1).put(iv).put(ciphertext).array();FileOutputStream output=null;try{output=file.startWrite();for(int pos=0;pos<encoded.length;pos+=65536){check.check();output.write(encoded,pos,Math.min(65536,encoded.length-pos));}output.getFD().sync();check.check();file.finishWrite(output);output=null;}finally{if(output!=null)file.failWrite(output);}syncBirthDirectory(directory);byte[] actual=readDownloadObject(directory,ref,check);try{require(MessageDigest.isEqual(actual,bytes));}finally{Arrays.fill(actual,(byte)0);}}finally{if(encoded!=null)Arrays.fill(encoded,(byte)0);if(ciphertext!=null)Arrays.fill(ciphertext,(byte)0);}
    }
    private void cleanupDownloadObjects(File directory,State state,String profile,Check check)throws Exception {if(profile==null)return;PlanetChildJourney.identifier(profile);String prefix="route-object-v1-"+digest(profile.getBytes(StandardCharsets.UTF_8))+"-";Set<String> retained=new HashSet<>();for(PlanetChildRouteDownload.ObjectRef ref:state.downloads.objects.values())retained.add(downloadObjectFile(directory,ref).getBaseFile().getName());File[] files=directory.listFiles();require(files!=null);for(File file:files)if(file.getName().matches(prefix+"[a-f0-9]{64}(?:\\.bak|\\.new)?")&&!retained.contains(file.getName().replaceFirst("\\.(?:bak|new)$",""))){check.check();require(file.getAbsoluteFile().equals(file.getCanonicalFile())&&OsConstants.S_ISREG(Os.lstat(file.getPath()).st_mode));Os.remove(file.getPath());}syncBirthDirectory(directory);check.check();}
    byte[] admittedRouteObject(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,PlanetChildRouteDownload.ObjectRef ref)throws Exception {return admittedRouteObject(admission,lease,ref,false);}
    byte[] admittedRouteObject(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,PlanetChildRouteDownload.ObjectRef ref,boolean absentAllowed)throws Exception {return locked(directory->{admission.check();existingRecord(directory);noPendingExceptDownload(directory);try(State state=read(directory)){admittedLive(admission,lease,state);validateDownloads(state);if(passportPending(directory).exists()){String id=admission.routeReadPendingCommand();PassportEntry entry=state.passports.get(lease.scope.profileId);require(entry!=null);byte[] actual=boundedRegular(passportPending(directory),4096),expected=passportMarkerBytes(admission,lease,id,entry.revision,entry.ledger,state);try{require(MessageDigest.isEqual(actual,expected));}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}}require(ref.profileId.equals(lease.scope.profileId));if(absentAllowed&&!state.downloads.objects.containsKey(ref.key())){admission.check();return null;}require(ref.equals(state.downloads.objects.get(ref.key())));byte[] bytes=readDownloadObject(directory,ref,admission::check);try{admittedLive(admission,lease,state);admission.check();return bytes;}catch(Exception failure){Arrays.fill(bytes,(byte)0);throw failure;}}});}
    private PlanetChildPassport.Ledger applyRouteDownload(File directory,State state,String profile,PlanetChildVault.LocalV2CountryOpenPermit permit,PlanetChildVault.LocalV2DataAdmission admission,PlanetChildPassport.Ledger ledger)throws Exception {
        permit.check(admission);state.downloads.present=true;String id=permit.downloadKey(admission);PlanetChildRouteDownload.Stage old=state.downloads.stages.get(id),next=permit.downloadStage(admission);String action=permit.downloadAction(admission);
        if("cancel".equals(action)){if(old!=null){state.downloads.stages.remove(id);old.close();}collectDownloadObjects(state);return ledger;}
        require(next!=null&&next.profileId.equals(profile));if("resume".equals(action)){require(old!=null&&old.route.equals(next.route)&&next.completed==old.completed+1&&next.reused>=old.reused&&next.reused<=old.reused+1);}else require("save".equals(action)&&next.completed==0&&next.reused==0);
        if("resume".equals(action)){List<PlanetChildRouteDownload.ObjectRef> refs=next.objects();PlanetChildRouteDownload.ObjectRef ref=refs.get(next.completed-1);PlanetChildRouteDownload.ObjectRef existing=state.downloads.objects.get(ref.key());require(existing==null||existing.equals(ref));require((next.reused==old.reused+1)==(existing!=null));byte[] bytes=permit.downloadBytes(admission);try{permit.verifyDownloadObject(admission,next.completed-1,bytes);writeDownloadObject(directory,ref,bytes,()->permit.check(admission));state.downloads.objects.put(ref.key(),ref);}finally{Arrays.fill(bytes,(byte)0);}}
        if(next.ready()){List<PlanetChildRouteDownload.ObjectRef> refs=next.objects();for(int i=0;i<refs.size();i++){PlanetChildRouteDownload.ObjectRef ref=refs.get(i);require(ref.equals(state.downloads.objects.get(ref.key())));byte[] bytes=readDownloadObject(directory,ref,()->permit.check(admission));try{permit.verifyDownloadObject(admission,i,bytes);}finally{Arrays.fill(bytes,(byte)0);}}permit.check(admission);ledger=ledger.saved(next.route.detached());state.downloads.stages.remove(id);}else state.downloads.stages.put(id,next.detached());if(old!=null)old.close();collectDownloadObjectsWithLedger(state,profile,ledger);state.downloads.validate();return ledger;
    }
    private static void collectDownloadObjectsWithLedger(State state,String profile,PlanetChildPassport.Ledger ledger)throws Exception {PassportEntry prior=state.passports.get(profile);state.passports.put(profile,new PassportEntry(prior==null?1:prior.revision,ledger));try{collectDownloadObjects(state);}finally{if(prior==null)state.passports.remove(profile);else state.passports.put(profile,prior);}}

    // Separately versioned passport after the retained Journey extension.
    private static final class PassportEntry {
        final long revision;final PlanetChildPassport.Ledger ledger;
        PassportEntry(long revision,PlanetChildPassport.Ledger ledger){this.revision=revision;this.ledger=ledger;}
    }
    static final class PassportResult implements AutoCloseable {
        final String profileId;final long revision;final PlanetChildPassport.Ledger ledger;final Map<String,PlanetChildJourney.Progress> journeys;final Map<String,PlanetChildRouteDownload.Stage> routeStages;final Map<String,PlanetChildRouteDownload.ObjectRef> routeObjects;private boolean closed;
        PassportResult(String profile,long revision,PlanetChildPassport.Ledger ledger,Map<String,PlanetChildJourney.Progress> journeys)throws Exception {this(profile,revision,ledger,journeys,new PlanetChildRouteDownload.Catalog());}
        PassportResult(String profile,long revision,PlanetChildPassport.Ledger ledger,Map<String,PlanetChildJourney.Progress> journeys,PlanetChildRouteDownload.Catalog catalog)throws Exception {profileId=profile;this.revision=revision;this.ledger=ledger.detached();this.journeys=Collections.unmodifiableMap(new TreeMap<>(journeys));TreeMap<String,PlanetChildRouteDownload.Stage> stages=new TreeMap<>();try{for(PlanetChildRouteDownload.Stage stage:catalog.stages.values())if(stage.profileId.equals(profile))stages.put(stage.route.key(),stage.detached());TreeMap<String,PlanetChildRouteDownload.ObjectRef> objects=new TreeMap<>();for(PlanetChildRouteDownload.ObjectRef ref:catalog.objects.values())if(ref.profileId.equals(profile))objects.put(ref.key(),ref);routeStages=Collections.unmodifiableMap(stages);routeObjects=Collections.unmodifiableMap(objects);}catch(Exception failure){this.ledger.wipe();for(PlanetChildRouteDownload.Stage stage:stages.values())stage.close();throw failure;}}
        synchronized boolean closedForSDK(){return closed;}public synchronized void close(){if(!closed){closed=true;ledger.wipe();for(PlanetChildRouteDownload.Stage stage:routeStages.values())stage.close();}}
    }
    private static void validatePassport(State state) throws Exception {
        if(!state.sdkPassport){require(state.passports.isEmpty());return;}
        require(state.sdkJourney&&state.sdkAppearance&&state.sdkCollections&&state.admissionBinding!=null&&state.sdkUnboundBirth==null&&state.passports.size()<=4&&state.seals.keySet().containsAll(state.passports.keySet()));
        for(Map.Entry<String,PassportEntry> row:state.passports.entrySet()){require(identifier(row.getKey())&&row.getValue().revision>0);PlanetChildAppearance.revision(row.getValue().revision);byte[] bytes=row.getValue().ledger.encode();try{PlanetChildPassport.Ledger decoded=PlanetChildPassport.decode(bytes);try{require(decoded.equals(row.getValue().ledger));}finally{decoded.wipe();}}finally{Arrays.fill(bytes,(byte)0);}
            JourneyEntry journeys=state.journeys.get(row.getKey());for(PlanetChildPassport.Credit credit:row.getValue().ledger.credits){PlanetChildJourney.Progress progress=journeys==null?null:journeys.values.get(credit.journeyId);require(progress!=null&&progress.completedNodeIds.contains(credit.nodeId));}for(PlanetChildPassport.CompletedJourney receipt:row.getValue().ledger.completedJourneys){PlanetChildJourney.Progress progress=journeys==null?null:journeys.values.get(receipt.journeyId);require(progress!=null&&progress.completedNodeIds.containsAll(receipt.nodeIds));}for(PlanetChildPassport.Award award:row.getValue().ledger.awards){PlanetChildJourney.Progress progress=journeys==null?null:journeys.values.get(award.journeyId);require(progress!=null&&progress.completedNodeIds.containsAll(award.nodeIds)&&row.getValue().ledger.confirms(award));}
        }
    }
    private static void encodePassport(State state,DataOutputStream out) throws Exception {
        validatePassport(state);if(!state.sdkPassport)return;out.writeInt(0x4c505032);out.writeByte(1);out.writeByte(state.passports.size());
        for(Map.Entry<String,PassportEntry> row:state.passports.entrySet()){out.writeUTF(row.getKey());out.writeLong(row.getValue().revision);byte[] bytes=row.getValue().ledger.encode();try{out.writeInt(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    }
    private static void decodePassport(State state,DataInputStream in) throws Exception {
        require(in.readInt()==0x4c505032&&in.readUnsignedByte()==1&&state.sdkJourney);state.sdkPassport=true;int n=in.readUnsignedByte();require(n<=4);
        for(int i=0;i<n;i++){String profile=in.readUTF();long revision=in.readLong();int length=in.readInt();require(length>0&&length<=PlanetChildPassport.MAX_BYTES&&length<=in.available()&&!state.passports.containsKey(profile));byte[] bytes=new byte[length];try{in.readFully(bytes);state.passports.put(profile,new PassportEntry(revision,PlanetChildPassport.decode(bytes)));}finally{Arrays.fill(bytes,(byte)0);}}validatePassport(state);
    }
    private static void preparePassportWrite(State state,String profile,long revision,PlanetChildPassport.Ledger ledger) throws Exception {
        PassportEntry previous=state.passports.get(profile);if(previous!=null)for(PlanetChildPassport.Route prior:previous.ledger.routes)if(ledger.routes.stream().noneMatch(next->next==prior))prior.wipe();state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true;state.passports.put(profile,new PassportEntry(revision,ledger));byte[] bounded=encode(state);try{validatePassport(state);}finally{Arrays.fill(bounded,(byte)0);}
    }
    private static void migratePassport(State state) throws Exception {collectDownloadObjects(state);validateDownloads(state);validatePassport(state);require(sealBindings(state).keySet().containsAll(state.passports.keySet()));}
    private File passportPending(File directory)throws Exception {File file=new File(directory,"passport-pending-v2");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void exclusivePassportMarker(File directory,byte[] marker,Check check) throws Exception {
        require(marker!=null&&marker.length>0&&marker.length<=4096);check.check();FileDescriptor fd=Os.open(passportPending(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
        try(FileOutputStream out=new FileOutputStream(fd)){out.write(marker);out.getFD().sync();}syncBirthDirectory(directory);byte[] actual=boundedRegular(passportPending(directory),4096);try{require(MessageDigest.isEqual(marker,actual));check.check();}finally{Arrays.fill(actual,(byte)0);}
    }
    private byte[] passportMarkerBytes(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId,long revision,PlanetChildPassport.Ledger ledger,State state) throws Exception {
        byte[] bytes=ledger.encode();try{return ("LP-LOCAL-V2-PASSPORT\n"+identity+"\n"+commandId+"\n"+admission.binding()+"\n"+lease.scope.profileId+"\n"+lease.generation+"\n"+lease.nonce+"\n"+revision+"\n"+digest(bytes)+"\n"+(state.downloads.present?downloadDigest(state)+"\n":"")).getBytes(StandardCharsets.US_ASCII);}finally{Arrays.fill(bytes,(byte)0);}
    }
    PassportResult admittedPassport(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Long expected,PlanetChildVault.LocalV2CountryOpenPermit permit,String commandId) throws Exception {
        require((expected==null)==(permit==null));return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){
            admittedLive(admission,lease,state);validatePassport(state);String profile=lease.scope.profileId;PassportEntry old=state.passports.get(profile);long revision=old==null?0:old.revision;PlanetChildPassport.Ledger ledger=old==null?PlanetChildPassport.empty():old.ledger;JourneyEntry retained=state.journeys.get(profile);
            if(permit==null){PassportResult result=new PassportResult(profile,revision,ledger,retained==null?Collections.emptyMap():retained.values,state.downloads);try{admission.check();return result;}catch(Exception failure){result.close();throw failure;}}
            require(expected==revision&&profile.equals(permit.profileId(admission))&&!downloadRecovery(directory).exists());byte[] beforeDownload=permit.isRouteDownload()?encode(state):null;
            try{long next=PlanetChildAppearance.next(revision);ledger=permit.isRouteDownload()?applyRouteDownload(directory,state,profile,permit,admission,ledger):permit.apply(admission,ledger);state.downloads.clearCheckpoint();if(permit.isRouteDownload()){state.downloads.checkpointProfile=profile;state.downloads.checkpointRevision=next;byte[] checkpoint=ledger.encode();try{state.downloads.checkpointLedger=digest(checkpoint);}finally{Arrays.fill(checkpoint,(byte)0);}state.downloads.checkpointTerminal=!state.downloads.stages.containsKey(permit.downloadKey(admission));}preparePassportWrite(state,profile,next,ledger);byte[] marker=passportMarkerBytes(admission,lease,commandId,next,ledger,state);boolean attempted=false;
            try{attempted=true;if(permit.isRouteDownload()&&!state.downloads.checkpointTerminal)writeDownloadRecovery(directory,beforeDownload,state,marker,()->permit.check(admission));exclusivePassportMarker(directory,marker,()->permit.check(admission));write(directory,state,()->permit.check(admission));try(State actual=read(directory)){admittedLive(admission,lease,actual);permit.check(admission);byte[] before=encode(state),after=encode(actual);try{require(MessageDigest.isEqual(before,after));}finally{Arrays.fill(before,(byte)0);Arrays.fill(after,(byte)0);}}
                byte[] pending=boundedRegular(passportPending(directory),4096);try{require(MessageDigest.isEqual(marker,pending));}finally{Arrays.fill(pending,(byte)0);}cleanupDownloadObjects(directory,state,profile,()->permit.check(admission));admission.passportCommandKnown(commandId);PassportResult result=new PassportResult(profile,next,ledger,retained==null?Collections.emptyMap():retained.values,state.downloads);try{admission.passportCommandReady(commandId);return result;}catch(Exception failure){result.close();throw failure;}
            }catch(Throwable failure){if(attempted){closed=true;admission.passportUnknown();}if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}finally{Arrays.fill(marker,(byte)0);}
            }finally{if(beforeDownload!=null)Arrays.fill(beforeDownload,(byte)0);}
        }});
    }
    static final class PassportCompletion implements AutoCloseable {
        private final PlanetChildDataStore store;private final byte[] marker;private boolean closed,completed;
        PassportCompletion(PlanetChildDataStore store,byte[] marker){this.store=store;this.marker=marker.clone();}
        synchronized void complete() throws Exception {require(!closed&&!completed);store.locked(directory->{require(!store.closed);byte[] actual=store.boundedRegular(store.passportPending(directory),4096);try{require(MessageDigest.isEqual(actual,marker));if(store.downloadRecovery(directory).exists()){byte[] receipt=store.readDownloadRecovery(directory);try{require(downloadRecoveryFields(receipt)[6].equals(digest(marker)));}finally{Arrays.fill(receipt,(byte)0);}}Os.remove(store.passportPending(directory).getPath());store.syncBirthDirectory(directory);if(store.downloadRecovery(directory).exists()){Os.remove(store.downloadRecovery(directory).getPath());store.syncBirthDirectory(directory);}return null;}finally{Arrays.fill(actual,(byte)0);}});completed=true;}
        synchronized void retainUnknown() throws Exception {require(!closed);store.locked(directory->{if(!store.passportPending(directory).exists())store.exclusivePassportMarker(directory,marker,()->{});store.closed=true;return null;});}
        public synchronized void close(){closed=true;Arrays.fill(marker,(byte)0);}
    }
    PassportCompletion passportComplete(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId) throws Exception {
        final PassportCompletion[] retained=new PassportCompletion[1];try{return locked(directory->{admission.check();try(State state=read(directory)){admittedLive(admission,lease,state);validatePassport(state);admission.passportCommandJoined(commandId);PassportEntry entry=state.passports.get(lease.scope.profileId);require(entry!=null);byte[] actual=boundedRegular(passportPending(directory),4096),expected=passportMarkerBytes(admission,lease,commandId,entry.revision,entry.ledger,state);try{require(MessageDigest.isEqual(actual,expected));retained[0]=new PassportCompletion(this,expected);admission.check();return retained[0];}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}}});}
        catch(Throwable failure){closed=true;admission.passportUnknown();if(retained[0]!=null)retained[0].close();if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}
    }


    /** Only original authenticated V2 deletion admission supplies this partition. */
    private static void removeOwnedState(State state,String profile,String scope)throws Exception {
        require(identifier(profile)&&Arrays.asList("history","profile","downloads").contains(scope));if(profile.equals(state.downloads.checkpointProfile))state.downloads.clearCheckpoint();Iterator<PlanetChildRouteDownload.Stage> pending=state.downloads.stages.values().iterator();while(pending.hasNext()){PlanetChildRouteDownload.Stage stage=pending.next();if(stage.profileId.equals(profile)){stage.close();pending.remove();}}if("downloads".equals(scope)){PassportEntry prior=state.passports.get(profile);if(prior!=null){PlanetChildPassport.Ledger cleared=prior.ledger.clearedRoutes();long revision=PlanetChildAppearance.next(prior.revision);prior.ledger.wipe();state.passports.put(profile,new PassportEntry(revision,cleared));}collectDownloadObjects(state);return;}boolean all="profile".equals(scope);
        Iterator<Map.Entry<String,Stored>> rows=state.entries.entrySet().iterator();while(rows.hasNext()){Map.Entry<String,Stored> row=rows.next();int split=row.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(row.getKey().substring(0,split));Scope owner=keyScope(purpose,row.getKey().substring(split+1));if(profile.equals(owner.profileId)&&(all||purpose==Purpose.history)){Arrays.fill(row.getValue().value,(byte)0);rows.remove();}}
        state.reading.remove(profile);state.journeys.remove(profile);PassportEntry removedPassport=state.passports.remove(profile);if(removedPassport!=null)removedPassport.ledger.wipe();
        if(all){state.appearances.remove(profile);state.collectionRevisions.keySet().removeIf(id->id.startsWith(profile+"\n"));Iterator<String> tombs=state.tombstones.keySet().iterator();while(tombs.hasNext()){String id=tombs.next();int split=id.indexOf('\n');Purpose purpose=Purpose.valueOf(id.substring(0,split));if(profile.equals(keyScope(purpose,id.substring(split+1)).profileId))tombs.remove();}state.seals.remove(profile);if(profile.equals(state.sdkUnboundBirth)){state.sdkUnboundBirth=null;state.sdkUnboundContent=null;}}
        else state.collectionRevisions.remove(profile+"\nhistory");
    }


    /** Cross-file migration marker already denies cold restart until exact deletion settlement. */
    private void redactBirth(File directory,PlanetChildVault.LocalV2DataAdmission admission,String profile)throws Exception {
        admission.check();byte[] original=knownPlain(directory),redacted=null,encoded=null,ciphertext=null;FileOutputStream output=null;boolean started=false;
        try{redacted=PlanetChildVault.LocalV2KnownBirth.redacted(context,identity,original,profile);if(redacted==null)return;admission.check();AtomicFile file=knownRecord(directory);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key(false,directory));byte[] iv=cipher.getIV();require(iv!=null&&iv.length==12);cipher.updateAAD((identity+"\nLP-LOCAL-V2-KNOWN-BIRTH-v1").getBytes(StandardCharsets.US_ASCII));ciphertext=cipher.doFinal(redacted);encoded=ByteBuffer.allocate(13+ciphertext.length).put((byte)1).put(iv).put(ciphertext).array();
            started=true;output=file.startWrite();admission.check();output.write(encoded);output.getFD().sync();admission.check();file.finishWrite(output);output=null;
            byte[] actual=knownPlain(directory);try{require(MessageDigest.isEqual(redacted,actual));PlanetChildVault.LocalV2KnownBirth proof=knownBirth(directory);require(proof.profileId==null&&proof.contentBinding==null);admission.check();}finally{Arrays.fill(actual,(byte)0);}
        }catch(Throwable failure){closed=true;if(output!=null)try{knownRecord(directory).failWrite(output);}catch(Throwable cleanup){failure.addSuppressed(cleanup);}if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}
        finally{Arrays.fill(original,(byte)0);if(redacted!=null)Arrays.fill(redacted,(byte)0);if(encoded!=null)Arrays.fill(encoded,(byte)0);if(ciphertext!=null)Arrays.fill(ciphertext,(byte)0);}
    }


    /** AUTHORED_NOT_RUN shared semantic golden plus exact sibling preservation. */
    private static State fixturePassportState()throws Exception {
        State state=fixtureAppearanceState();state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true;
        for(String profile:state.seals.keySet()){PlanetChildJourney.Progress progress=new PlanetChildJourney.Progress("journey-one",2,2,null,Arrays.asList("node-one","node-two","z-retired-node"),"country-one",null,null,"journey");state.journeys.put(profile,new JourneyEntry(7,"journey-one",Collections.singletonMap("journey-one",progress)));
            PlanetChildPassport.Ledger ledger=new PlanetChildPassport.Ledger(Arrays.asList("country-one"),Arrays.asList(new PlanetChildPassport.Credit("journey-one","node-one","writer","writer-one",2,2),new PlanetChildPassport.Credit("journey-one","node-two","work","work-one",2,2)),Arrays.asList(new PlanetChildPassport.CompletedJourney("journey-one",2,2,Arrays.asList("node-one","node-two"))));state.passports.put(profile,new PassportEntry(3,ledger));state.appearances.put(profile,new AppearanceEntry(5,fixtureAppearanceSelection("one")));
            Scope owner=state.seals.get(profile).scope;byte[] history=new JSONObject().put("schemaVersion",1).put("scope",fixtureSDKScope(owner)).put("references",new JSONArray()).toString().getBytes(StandardCharsets.UTF_8);state.entries.put(Purpose.history.name()+"\n"+owner.key(Purpose.history),new Stored(7,history));state.collectionRevisions.put(collectionId(owner,Purpose.history),9L);
            for(Purpose purpose:Arrays.asList(Purpose.cache,Purpose.offline)){String kind=purpose==Purpose.cache?"favorite":"offline-package",id=kind+"-one";JSONObject row=new JSONObject().put("reference",new JSONObject().put("kind",kind).put("id",id).put("contentChecksum",owner.packageChecksum)).put("payload",new JSONObject().put("title","Fixture").put("text","").put("terms",new JSONArray()).put("references",new JSONArray()));byte[] value=new JSONObject().put("schemaVersion",1).put("scope",fixtureSDKScope(owner)).put("entries",new JSONArray().put(row)).toString().getBytes(StandardCharsets.UTF_8);state.entries.put(purpose.name()+"\n"+owner.itemKey(purpose,kind,id),new Stored(11,value));state.collectionRevisions.put(collectionId(owner,purpose),5L);}
        }return state;
    }
    static boolean fixturePassportScenario(Context context,String scenario)throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("legacy","atomic","history","profile","last-profile","corrupt").contains(scenario));
        if("legacy".equals(scenario)){try(State state=fixtureAppearanceState()){state.sdkAppearance=true;state.sdkJourney=true;PlanetChildJourney.Progress archived=fixtureJourneyProgress("journey-one",null,Arrays.asList("writer-looking-prefix","node-one"));state.journeys.put("fixture-reader-one",new JourneyEntry(1,archived.journeyId,Collections.singletonMap(archived.journeyId,archived)));byte[] bytes=encode(state);try(State restored=decode(bytes)){require(!restored.sdkPassport&&restored.passports.isEmpty()&&restored.journeys.get("fixture-reader-one").values.get("journey-one").completedNodeIds.equals(archived.completedNodeIds));}finally{Arrays.fill(bytes,(byte)0);}}return true;}
        try(State state=fixturePassportState()){byte[] original=encode(state);try{String target="fixture-reader-one",sibling="fixture-reader-two";PassportEntry siblingPassport=state.passports.get(sibling);JourneyEntry siblingJourney=state.journeys.get(sibling);AppearanceEntry targetAppearance=state.appearances.get(target),siblingAppearance=state.appearances.get(sibling);TreeMap<String,Stored> beforeEntries=new TreeMap<>(state.entries);
            if("history".equals(scenario)||"profile".equals(scenario)||"last-profile".equals(scenario)){removeOwnedState(state,target,"history".equals(scenario)?"history":"profile");require(!state.journeys.containsKey(target)&&!state.passports.containsKey(target)&&siblingPassport==state.passports.get(sibling)&&siblingJourney==state.journeys.get(sibling)&&siblingAppearance==state.appearances.get(sibling));require("history".equals(scenario)?state.seals.containsKey(target)&&state.appearances.get(target)==targetAppearance:!state.seals.containsKey(target)&&!state.appearances.containsKey(target));
                for(Map.Entry<String,Stored> row:beforeEntries.entrySet()){int split=row.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(row.getKey().substring(0,split));Scope owner=keyScope(purpose,row.getKey().substring(split+1));if(owner.profileId.equals(sibling)||"history".equals(scenario)&&purpose!=Purpose.history)require(state.entries.get(row.getKey())==row.getValue());else require(!state.entries.containsKey(row.getKey()));}
                if("last-profile".equals(scenario)){removeOwnedState(state,sibling,"profile");require(state.seals.isEmpty()&&state.entries.isEmpty()&&state.journeys.isEmpty()&&state.passports.isEmpty()&&state.appearances.isEmpty()&&state.collectionRevisions.isEmpty());}
            }
            byte[] changed=encode(state);try{if("corrupt".equals(scenario)){byte[] shortBytes=Arrays.copyOf(changed,changed.length-1);boolean denied=false;try(State ignored=decode(shortBytes)){}catch(Exception unavailable){denied=true;}finally{Arrays.fill(shortBytes,(byte)0);}require(denied);return true;}
                try(State restored=decode(changed)){byte[] exact=encode(restored);try{require(MessageDigest.isEqual(changed,exact));if("atomic".equals(scenario)){PassportEntry ledger=restored.passports.get(target);require(ledger.revision==3&&ledger.ledger.credits.size()==2&&ledger.ledger.completedJourneys.size()==1&&restored.journeys.get(target).values.get("journey-one").completedNodeIds.containsAll(Arrays.asList("node-one","node-two","z-retired-node")));}if("last-profile".equals(scenario))require(restored.seals.isEmpty()&&restored.passports.isEmpty());}finally{Arrays.fill(exact,(byte)0);}}
            }finally{Arrays.fill(changed,(byte)0);}return true;
        }finally{Arrays.fill(original,(byte)0);}}
    }
    /** Read-only assertion on the real namespace after an operator-authorized
     * genuine deletion. This helper creates no proof, grant, seed or key. */
    static boolean fixtureGenuineRemovalReadback(Context context,String removed)throws Exception {
        fixtureAppearanceContext(context);require(identifier(removed));PlanetChildDataStore store=new PlanetChildDataStore(context);
        return store.locked(directory->{store.existingOnly(directory);PlanetChildVault.LocalV2KnownBirth birth=store.knownBirth(directory);require(!removed.equals(birth.profileId));
            try(State state=store.read(directory)){require(state.scope==null&&state.pendingMigration==null&&!state.seals.containsKey(removed)&&!removed.equals(state.sdkUnboundBirth)&&!state.appearances.containsKey(removed)&&!state.journeys.containsKey(removed)&&!state.passports.containsKey(removed));
                for(String key:state.collectionRevisions.keySet())require(!key.startsWith(removed+"\n"));
                for(String key:state.entries.keySet()){int at=key.indexOf('\n');require(!removed.equals(keyScope(Purpose.valueOf(key.substring(0,at)),key.substring(at+1)).profileId));}
                for(String key:state.tombstones.keySet()){int at=key.indexOf('\n');require(!removed.equals(keyScope(Purpose.valueOf(key.substring(0,at)),key.substring(at+1)).profileId));}
            }
            return true;
        });
    }

    static boolean fixturePassportPersistence(Context context,String runId,String phase)throws Exception {
        fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}")&&Arrays.asList("write","read","pending","pending-reopen").contains(phase));PlanetChildDataStore store="write".equals(phase)?synthetic(context,runId):new PlanetChildDataStore(context,runId,true);
        return store.locked(directory->{if(!"write".equals(phase))store.existingRecord(directory);if("write".equals(phase)){try(State state=fixturePassportState()){store.write(directory,state,()->{});return true;}}
            try(State state=store.read(directory)){require(state.passports.get("fixture-reader-one").revision==3&&state.passports.get("fixture-reader-one").ledger.credits.size()==2&&state.passports.get("fixture-reader-two").revision==3);if("read".equals(phase)){store.noPendingOperations(directory);return true;}
                if("pending".equals(phase)){store.noPendingOperations(directory);byte[] marker=("LP-SOFTWARE-PASSPORT-PENDING\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);try{store.exclusivePassportMarker(directory,marker,()->{});}finally{Arrays.fill(marker,(byte)0);}}require(store.passportPending(directory).isFile());boolean denied=false;try{store.noPendingOperations(directory);}catch(Exception unavailable){denied=true;}require(denied);return true;}
        });
    }

    /** AUTHORED_NOT_RUN synthetic actual-byte fixtures, never an admitted permit. */
    static PlanetChildPassport.Route fixturePassportRoute(Context context,String id)throws Exception {byte[] snapshot=PlanetChildVault.fixturePassportRouteBytes(context,id);String hash="a".repeat(64);try{return new PlanetChildPassport.Route(id,2,2,"fixture-package",2,hash,hash,"fixture-policy",hash,"ru",7,"android-google","RU",snapshot);}finally{Arrays.fill(snapshot,(byte)0);}}
    private static void fixtureRouteFacts(Context context,State state,String profile)throws Exception {PassportEntry saved=state.passports.get(profile);PlanetChildPassport.Ledger ledger=saved.ledger;PlanetChildPassport.Award award=new PlanetChildPassport.Award("fixture-program",1,"b".repeat(64),"c".repeat(64),"fixture-badge",1,"journey-one",2,2,"completed-learning",Arrays.asList("node-one","node-two"));require(ledger.confirms(award));state.passports.put(profile,new PassportEntry(saved.revision,ledger.awarded(award).saved(fixturePassportRoute(context,"journey-one"))));}
    static boolean fixturePassportRouteScenario(Context context,String scenario)throws Exception {fixtureAppearanceContext(context);require(Arrays.asList("codec","downloads","history","profile","corrupt").contains(scenario));try(State state=fixturePassportState()){fixtureRouteFacts(context,state,"fixture-reader-one");fixtureRouteFacts(context,state,"fixture-reader-two");byte[] original=encode(state);try{String target="fixture-reader-one",sibling="fixture-reader-two";PassportEntry one=state.passports.get(target),two=state.passports.get(sibling);JourneyEntry journey=state.journeys.get(target);AppearanceEntry appearance=state.appearances.get(target);TreeMap<String,Stored> entries=new TreeMap<>(state.entries);if("corrupt".equals(scenario)){byte[] changed=original.clone();changed[changed.length-1]^=1;boolean refused=false;try(State ignored=decode(changed)){}catch(Exception unavailable){refused=true;}finally{Arrays.fill(changed,(byte)0);}require(refused);return true;}
            if(!"codec".equals(scenario)){removeOwnedState(state,target,scenario);require(two==state.passports.get(sibling)&&two.ledger.routes.size()==1&&two.ledger.awards.size()==1);if("downloads".equals(scenario)){PassportEntry cleared=state.passports.get(target);require(cleared.revision==one.revision+1&&cleared.ledger.routes.isEmpty()&&cleared.ledger.awards.equals(one.ledger.awards)&&cleared.ledger.credits.equals(one.ledger.credits)&&state.journeys.get(target)==journey&&state.appearances.get(target)==appearance);for(Map.Entry<String,Stored> entry:entries.entrySet())require(entry.getValue()==state.entries.get(entry.getKey()));}else require(!state.passports.containsKey(target)&&!state.journeys.containsKey(target));}
            byte[] changed=encode(state);try(State actual=decode(changed)){byte[] exact=encode(actual);try{require(MessageDigest.isEqual(changed,exact)&&actual.passports.get(sibling).ledger.awards.size()==1&&actual.passports.get(sibling).ledger.routes.size()==1);PassportResult detached=new PassportResult(sibling,actual.passports.get(sibling).revision,actual.passports.get(sibling).ledger,actual.journeys.get(sibling).values);actual.close();try{byte[] preserved=detached.ledger.routes.get(0).copy();try{require(digest(preserved).equals(detached.ledger.routes.get(0).snapshotChecksum));}finally{Arrays.fill(preserved,(byte)0);}}finally{detached.close();}}finally{Arrays.fill(exact,(byte)0);}}finally{Arrays.fill(changed,(byte)0);}return true;
        }finally{Arrays.fill(original,(byte)0);}}}
    static boolean fixturePassportRoutePersistence(Context context,String runId,String phase)throws Exception {fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}")&&Arrays.asList("write","read","pending","pending-reopen").contains(phase));PlanetChildDataStore store="write".equals(phase)?synthetic(context,runId):new PlanetChildDataStore(context,runId,true);return store.locked(directory->{if(!"write".equals(phase))store.existingRecord(directory);if("write".equals(phase)){try(State state=fixturePassportState()){fixtureRouteFacts(context,state,"fixture-reader-one");fixtureRouteFacts(context,state,"fixture-reader-two");store.write(directory,state,()->{});return true;}}try(State state=store.read(directory)){PlanetChildPassport.Ledger ledger=state.passports.get("fixture-reader-one").ledger;require(ledger.awards.size()==1&&ledger.routes.size()==1&&ledger.credits.size()==2&&state.passports.get("fixture-reader-two").ledger.routes.size()==1);byte[] saved=ledger.routes.get(0).copy(),current=PlanetChildVault.fixturePassportRouteBytes(context,"journey-one");try{require(MessageDigest.isEqual(saved,current)&&digest(saved).equals(ledger.routes.get(0).snapshotChecksum));}finally{Arrays.fill(saved,(byte)0);Arrays.fill(current,(byte)0);}if("read".equals(phase)){store.noPendingOperations(directory);return true;}if("pending".equals(phase)){store.noPendingOperations(directory);byte[] marker=("LP-SYNTHETIC-ROUTE-PENDING\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);try{store.exclusivePassportMarker(directory,marker,()->{});}finally{Arrays.fill(marker,(byte)0);}}require(store.passportPending(directory).isFile());boolean denied=false;try{store.noPendingOperations(directory);}catch(Exception unavailable){denied=true;}require(denied);return true;}});}


    static PlanetChildPassport.Route fixturePassportMediaRoute(Context context,String id,String locale)throws Exception {byte[] snapshot=PlanetChildVault.fixturePassportMediaRouteBytes(context,id,locale,"valid");String hash="a".repeat(64);try{return new PlanetChildPassport.Route(id,2,2,"fixture-package",2,hash,hash,"fixture-policy",hash,locale,7,"android-google","RU",snapshot);}finally{Arrays.fill(snapshot,(byte)0);}}
    private static void fixtureMediaRouteFacts(Context context,State state,String profile)throws Exception {fixtureRouteFacts(context,state,profile);PassportEntry saved=state.passports.get(profile);PlanetChildPassport.Ledger ledger=saved.ledger.saved(fixturePassportMediaRoute(context,"journey-one","ru")).saved(fixturePassportMediaRoute(context,"journey-one","en"));for(PlanetChildPassport.Route prior:saved.ledger.routes)if(ledger.routes.stream().noneMatch(next->next==prior))prior.wipe();state.passports.put(profile,new PassportEntry(saved.revision,ledger));}
    static boolean fixturePassportMediaScenario(Context context,String scenario)throws Exception {fixtureAppearanceContext(context);require(Arrays.asList("codec","downloads","history","profile","corrupt").contains(scenario));try(State state=fixturePassportState()){fixtureMediaRouteFacts(context,state,"fixture-reader-one");fixtureMediaRouteFacts(context,state,"fixture-reader-two");byte[] original=encode(state);try{String target="fixture-reader-one",sibling="fixture-reader-two";PassportEntry one=state.passports.get(target),two=state.passports.get(sibling);JourneyEntry journey=state.journeys.get(target);AppearanceEntry appearance=state.appearances.get(target);TreeMap<String,Stored> entries=new TreeMap<>(state.entries);if("corrupt".equals(scenario)){byte[] changed=original.clone();changed[changed.length-1]^=1;boolean refused=false;try(State ignored=decode(changed)){}catch(Exception unavailable){refused=true;}finally{Arrays.fill(changed,(byte)0);}require(refused);return true;}
            if(!"codec".equals(scenario)){removeOwnedState(state,target,scenario);require(two==state.passports.get(sibling)&&two.ledger.routes.size()==2&&two.ledger.awards.size()==1);if("downloads".equals(scenario)){PassportEntry cleared=state.passports.get(target);require(cleared.revision==one.revision+1&&cleared.ledger.routes.isEmpty()&&cleared.ledger.awards.equals(one.ledger.awards)&&cleared.ledger.credits.equals(one.ledger.credits)&&state.journeys.get(target)==journey&&state.appearances.get(target)==appearance);for(Map.Entry<String,Stored> entry:entries.entrySet())require(entry.getValue()==state.entries.get(entry.getKey()));}else require(!state.passports.containsKey(target)&&!state.journeys.containsKey(target));}
            byte[] changed=encode(state);try(State actual=decode(changed)){byte[] exact=encode(actual);try{require(MessageDigest.isEqual(changed,exact)&&actual.passports.get(sibling).ledger.awards.size()==1&&actual.passports.get(sibling).ledger.routes.size()==2);PassportResult detached=new PassportResult(sibling,actual.passports.get(sibling).revision,actual.passports.get(sibling).ledger,actual.journeys.get(sibling).values);actual.close();try{byte[] preserved=detached.ledger.routes.get(0).copy();try{require(digest(preserved).equals(detached.ledger.routes.get(0).snapshotChecksum));}finally{Arrays.fill(preserved,(byte)0);}}finally{detached.close();}}finally{Arrays.fill(exact,(byte)0);}}finally{Arrays.fill(changed,(byte)0);}return true;
        }finally{Arrays.fill(original,(byte)0);}}}
    /** AUTHORED_NOT_RUN actual encrypted AtomicFile/blob persistence leaves.
     * No synthetic leaf constructs the original SDK permit or parent proof. */
    private static byte[] fixtureSharedImage(boolean fullBound)throws Exception {
        android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(1,1,android.graphics.Bitmap.Config.ARGB_8888);byte[] base;try(ByteArrayOutputStream out=new ByteArrayOutputStream()){bitmap.setPixel(0,0,0xff123456);require(bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out));base=out.toByteArray();}finally{bitmap.recycle();}
        if(!fullBound)return base;byte[] padded=new byte[PlanetChildResources.MAX_RASTER];try{int insert=base.length-12,size=padded.length-base.length-12;require(size>0);System.arraycopy(base,0,padded,0,insert);ByteBuffer buffer=ByteBuffer.wrap(padded).order(java.nio.ByteOrder.BIG_ENDIAN);buffer.position(insert);buffer.putInt(size).put("lpAD".getBytes(StandardCharsets.US_ASCII));int data=buffer.position();buffer.position(data+size);java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(padded,insert+4,size+4);buffer.putInt((int)crc.getValue());System.arraycopy(base,insert,padded,buffer.position(),12);PlanetChildMedia.preflight(padded,"image/png");return padded;}finally{Arrays.fill(base,(byte)0);}
    }
    static boolean fixtureRouteDownloadPersistence(Context context,String runId,String scenario)throws Exception {
        fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}")&&Arrays.asList("reopen","full-bound","tamper","wrong-profile-aad","orphan","cancel-prior","downloads-clear","profile-clear","history-clear","locale-dedup","catalog-corrupt","uncertain-final-deny","late-cancel-completed").contains(scenario));
        String profile="fixture-reader-one",sibling="fixture-reader-two";byte[] image=fixtureSharedImage("full-bound".equals(scenario));PlanetChildDataStore store=synthetic(context,runId);
        try{store.locked(directory->{try(State state=fixturePassportState()){PlanetChildPassport.Route ru=PlanetChildVault.fixtureSharedPassportRoute(context,"journey-one","ru",image),en=PlanetChildVault.fixtureSharedPassportRoute(context,"journey-one","en",image),prior=fixturePassportRoute(context,"journey-one"),siblingRoute=PlanetChildVault.fixtureSharedPassportRoute(context,"journey-one","ru",image);try{
            PassportEntry own=state.passports.get(profile),other=state.passports.get(sibling);state.passports.put(profile,new PassportEntry(own.revision,own.ledger.saved(prior)));state.passports.put(sibling,new PassportEntry(other.revision,other.ledger.saved(siblingRoute)));state.downloads.present=true;
            PlanetChildRouteDownload.Stage pending=new PlanetChildRouteDownload.Stage(profile,ru,1,0);state.downloads.stages.put(pending.key(),pending);PlanetChildRouteDownload.ObjectRef ref=pending.objects().get(0),siblingRef=PlanetChildVault.sharedPassportRouteObjects(sibling,siblingRoute).get(0);state.downloads.objects.put(ref.key(),ref);state.downloads.objects.put(siblingRef.key(),siblingRef);store.writeDownloadObject(directory,ref,image,()->{});store.writeDownloadObject(directory,siblingRef,image,()->{});
            state.downloads.checkpointProfile=profile;state.downloads.checkpointRevision=own.revision;byte[] ledger=state.passports.get(profile).ledger.encode();try{state.downloads.checkpointLedger=digest(ledger);}finally{Arrays.fill(ledger,(byte)0);}store.write(directory,state,()->{});
            if("locale-dedup".equals(scenario)){PlanetChildRouteDownload.Stage english=new PlanetChildRouteDownload.Stage(profile,en,1,1);state.downloads.stages.put(english.key(),english);require(english.objects().get(0).equals(ref)&&!en.equals(ru)&&state.downloads.objects.size()==2);store.write(directory,state,()->{});}
            if("late-cancel-completed".equals(scenario)){state.downloads.stages.remove(pending.key()).close();PassportEntry before=state.passports.get(profile);PlanetChildPassport.Ledger active=before.ledger.saved(ru.detached());state.passports.put(profile,new PassportEntry(before.revision+1,active));state.downloads.clearCheckpoint();collectDownloadObjects(state);store.write(directory,state,()->{});try(State readback=store.read(directory);PassportResult saved=new PassportResult(profile,readback.passports.get(profile).revision,readback.passports.get(profile).ledger,readback.journeys.get(profile).values,readback.downloads)){require(saved.revision==before.revision+1&&saved.routeStages.isEmpty()&&saved.ledger.routes.get(0).equals(ru));try(PlanetChildRouteDownload.Stage ready=new PlanetChildRouteDownload.Stage(profile,saved.ledger.routes.get(0),2,1)){Map<String,Object> terminal=ready.dto("ready");require("ready".equals(terminal.get("status"))&&terminal.get("completedItems").equals(terminal.get("totalItems"))&&terminal.get("downloadedBytes").equals(terminal.get("totalBytes")));}require(readback.passports.get(sibling).revision==other.revision&&readback.passports.get(sibling).ledger.routes.get(0).equals(siblingRoute));}}
            if("catalog-corrupt".equals(scenario)){byte[] catalog=state.downloads.encode();try{catalog[catalog.length-2]^=0x7f;boolean denied=false;try(PlanetChildRouteDownload.Catalog ignored=PlanetChildRouteDownload.Catalog.decode(catalog)){}catch(Exception unavailable){denied=true;}require(denied);}finally{Arrays.fill(catalog,(byte)0);}}
            if("tamper".equals(scenario)){File file=store.downloadObjectFile(directory,ref).getBaseFile();byte[] ciphertext=store.boundedRegular(file,image.length+29);try{ciphertext[ciphertext.length-1]^=1;try(FileOutputStream out=new FileOutputStream(file)){out.write(ciphertext);out.getFD().sync();}boolean denied=false;try{byte[] bad=store.readDownloadObject(directory,ref,()->{});Arrays.fill(bad,(byte)0);}catch(Exception unavailable){denied=true;}require(denied);}finally{Arrays.fill(ciphertext,(byte)0);}}
            if("wrong-profile-aad".equals(scenario)){byte[] ciphertext=store.boundedRegular(store.downloadObjectFile(directory,ref).getBaseFile(),image.length+29);try{try(FileOutputStream out=new FileOutputStream(store.downloadObjectFile(directory,siblingRef).getBaseFile())){out.write(ciphertext);out.getFD().sync();}boolean denied=false;try{byte[] bad=store.readDownloadObject(directory,siblingRef,()->{});Arrays.fill(bad,(byte)0);}catch(Exception unavailable){denied=true;}require(denied);}finally{Arrays.fill(ciphertext,(byte)0);}}
            if("orphan".equals(scenario)){PlanetChildRouteDownload.ObjectRef orphan=new PlanetChildRouteDownload.ObjectRef(profile,"d".repeat(64),"image/png",image.length);File orphanPath=store.downloadObjectFile(directory,orphan).getBaseFile();byte[] ciphertext=store.boundedRegular(store.downloadObjectFile(directory,ref).getBaseFile(),image.length+29);try(FileOutputStream out=new FileOutputStream(orphanPath)){out.write(ciphertext);out.getFD().sync();}finally{Arrays.fill(ciphertext,(byte)0);}require(!state.downloads.objects.containsKey(orphan.key()));store.cleanupDownloadObjects(directory,state,profile,()->{});require(!orphanPath.exists()&&store.downloadObjectFile(directory,siblingRef).getBaseFile().exists());}
            if("cancel-prior".equals(scenario)){PlanetChildRouteDownload.Stage removed=state.downloads.stages.remove(pending.key());removed.close();collectDownloadObjects(state);require(state.passports.get(profile).ledger.routes.get(0).equals(prior)&&state.passports.get(sibling).ledger.routes.get(0).equals(siblingRoute));store.write(directory,state,()->{});store.cleanupDownloadObjects(directory,state,profile,()->{});require(!store.downloadObjectFile(directory,ref).getBaseFile().exists()&&store.downloadObjectFile(directory,siblingRef).getBaseFile().exists());}
            if(Arrays.asList("downloads-clear","profile-clear","history-clear").contains(scenario)){String scope="downloads-clear".equals(scenario)?"downloads":"profile-clear".equals(scenario)?"profile":"history";long siblingRevision=state.passports.get(sibling).revision;removeOwnedState(state,profile,scope);collectDownloadObjects(state);store.write(directory,state,()->{});store.cleanupDownloadObjects(directory,state,profile,()->{});require(!store.downloadObjectFile(directory,ref).getBaseFile().exists()&&store.downloadObjectFile(directory,siblingRef).getBaseFile().exists()&&state.passports.get(sibling).revision==siblingRevision&&state.passports.get(sibling).ledger.routes.get(0).equals(siblingRoute));}
            if("uncertain-final-deny".equals(scenario)){state.downloads.checkpointTerminal=true;byte[] marker="LP-UNVERIFIED-FINAL\n".getBytes(StandardCharsets.US_ASCII);try{store.exclusivePassportMarker(directory,marker,()->{});boolean denied=false;try{store.noPendingOperations(directory);}catch(Exception unavailable){denied=true;}require(denied);}finally{Arrays.fill(marker,(byte)0);}}
            return null;
        }finally{ru.wipe();en.wipe();siblingRoute.wipe();}}});
        if(Arrays.asList("reopen","full-bound","locale-dedup").contains(scenario)){PlanetChildDataStore reopened=new PlanetChildDataStore(context,runId,true);reopened.locked(directory->{try(State state=reopened.read(directory)){PlanetChildRouteDownload.Stage stage=state.downloads.stages.get(profile+"\njourney-one\nru");require(stage!=null&&stage.completed==1&&state.passports.get(profile).ledger.routes.size()==1&&state.passports.get(sibling).ledger.routes.size()==1);byte[] bytes=reopened.readDownloadObject(directory,stage.objects().get(0),()->{});try{require(MessageDigest.isEqual(bytes,image));PlanetChildVault.checkSharedPassportObject(stage.route,0,bytes);}finally{Arrays.fill(bytes,(byte)0);}require(((Number)stage.dto("staging").get("completedItems")).intValue()==2&&((Number)stage.dto("staging").get("totalItems")).intValue()==3);if("full-bound".equals(scenario))require(image.length==PlanetChildResources.MAX_RASTER&&stage.route.byteLength()<PlanetChildPassport.MAX_ROUTE_BYTES);return null;}});}
        return true;
        }finally{Arrays.fill(image,(byte)0);}
    }
    /** Real encrypted storage mechanics with an explicit debug-only current-state
     * callback. This never constructs a genuine SDK read permit or parent grant. */
    static boolean fixtureRouteDownloadRecovery(Context context,String runId,String scenario)throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("before-partial","before-zero","after","after-partial","wrong-marker","receipt-tamper","wrong-current","terminal","unreceipted").contains(scenario));PlanetChildDataStore store=synthetic(context,runId);byte[] image=fixtureSharedImage(false);
        try{return store.locked(directory->{try(State state=fixturePassportState()){
            String profile="fixture-reader-one",sibling="fixture-reader-two";state.scope=state.seals.get(profile).scope;state.generation=7;PlanetChildPassport.Route prior=fixturePassportRoute(context,"journey-one");PassportEntry own=state.passports.get(profile);state.passports.put(profile,new PassportEntry(own.revision,own.ledger.saved(prior)));store.write(directory,state,()->{});byte[] before=encode(state),siblingBytes=state.passports.get(sibling).ledger.encode(),marker=("LP-SYNTHETIC-STAGE\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);
            try{PlanetChildPassport.Route route=PlanetChildVault.fixtureSharedPassportRoute(context,"journey-one","ru",image);try{PlanetChildRouteDownload.Stage stage=new PlanetChildRouteDownload.Stage(profile,route,1,0);state.downloads.present=true;state.downloads.stages.put(stage.key(),stage);PlanetChildRouteDownload.ObjectRef ref=stage.objects().get(0);state.downloads.objects.put(ref.key(),ref);store.writeDownloadObject(directory,ref,image,()->{});state.downloads.checkpointProfile=profile;state.downloads.checkpointRevision=own.revision;byte[] ledger=state.passports.get(profile).ledger.encode();try{state.downloads.checkpointLedger=digest(ledger);}finally{Arrays.fill(ledger,(byte)0);}
                if("terminal".equals(scenario)){state.downloads.checkpointTerminal=true;boolean denied=false;try{store.writeDownloadRecovery(directory,before,state,marker,()->{});}catch(Exception refusal){denied=true;}require(denied&&!store.downloadRecovery(directory).exists());return true;}
                if(!"unreceipted".equals(scenario))store.writeDownloadRecovery(directory,before,state,marker,()->{});store.exclusivePassportMarker(directory,marker,()->{});boolean after=scenario.startsWith("after");if(after)store.write(directory,state,()->{});
                File partial=new File(store.record(directory).getBaseFile()+".new");if(!"after".equals(scenario)){try(FileOutputStream out=new FileOutputStream(partial)){if(!"before-zero".equals(scenario))out.write(new byte[]{1,2,3,4,5});out.getFD().sync();}}
                if("wrong-marker".equals(scenario)){try(FileOutputStream out=new FileOutputStream(store.passportPending(directory))){out.write("wrong-marker".getBytes(StandardCharsets.US_ASCII));out.getFD().sync();}}
                if("receipt-tamper".equals(scenario)){byte[] damaged=store.boundedRegular(store.downloadRecovery(directory),2048);try{damaged[damaged.length-1]^=1;try(FileOutputStream out=new FileOutputStream(store.downloadRecovery(directory))){out.write(damaged);out.getFD().sync();}}finally{Arrays.fill(damaged,(byte)0);}}
                boolean shouldDeny=Arrays.asList("wrong-marker","receipt-tamper","wrong-current","unreceipted").contains(scenario),denied=false;
                try{store.recoverDownloadStaging(directory,()->{},actual->{require(!"wrong-current".equals(scenario)&&actual.admissionBinding.equals(state.admissionBinding)&&sealBindings(actual).equals(sealBindings(state)));});store.existingRecord(directory);}catch(Exception refusal){denied=true;}require(denied==shouldDeny);
                if(shouldDeny){require(partial.exists()&&store.passportPending(directory).exists());return true;}
                require(!partial.exists()&&!store.passportPending(directory).exists()&&!store.downloadRecovery(directory).exists());try(State actual=store.read(directory)){require(actual.scope==null&&actual.generation==8&&actual.passports.get(profile).ledger.routes.get(0).equals(prior));require(after?actual.downloads.stages.size()==1&&actual.downloads.stages.values().iterator().next().completed==1:actual.downloads.stages.isEmpty());byte[] siblingAfter=actual.passports.get(sibling).ledger.encode();try{require(MessageDigest.isEqual(siblingBytes,siblingAfter));}finally{Arrays.fill(siblingAfter,(byte)0);}if(after){byte[] bytes=store.readDownloadObject(directory,ref,()->{});try{require(MessageDigest.isEqual(bytes,image));}finally{Arrays.fill(bytes,(byte)0);}}}return true;
            }finally{route.wipe();}}finally{Arrays.fill(before,(byte)0);Arrays.fill(siblingBytes,(byte)0);Arrays.fill(marker,(byte)0);}
        }});}finally{Arrays.fill(image,(byte)0);}
    }
    static boolean fixturePassportMediaPersistence(Context context,String runId,String phase)throws Exception {fixtureAppearanceContext(context);require(runId!=null&&runId.matches("[a-f0-9]{32}")&&Arrays.asList("write","read","pending","pending-reopen").contains(phase));PlanetChildDataStore store="write".equals(phase)?synthetic(context,runId):new PlanetChildDataStore(context,runId,true);return store.locked(directory->{if(!"write".equals(phase))store.existingRecord(directory);if("write".equals(phase)){try(State state=fixturePassportState()){fixtureMediaRouteFacts(context,state,"fixture-reader-one");fixtureMediaRouteFacts(context,state,"fixture-reader-two");store.write(directory,state,()->{});return true;}}try(State state=store.read(directory)){PlanetChildPassport.Ledger ledger=state.passports.get("fixture-reader-one").ledger;require(ledger.awards.size()==1&&ledger.routes.size()==2&&ledger.credits.size()==2&&state.passports.get("fixture-reader-two").ledger.routes.size()==2);byte[] saved=ledger.routes.get(0).copy(),current=PlanetChildVault.fixturePassportMediaRouteBytes(context,"journey-one","ru","valid");try{require(MessageDigest.isEqual(saved,current)&&digest(saved).equals(ledger.routes.get(0).snapshotChecksum));}finally{Arrays.fill(saved,(byte)0);Arrays.fill(current,(byte)0);}if("read".equals(phase)){store.noPendingOperations(directory);return true;}if("pending".equals(phase)){store.noPendingOperations(directory);byte[] marker=("LP-SYNTHETIC-ROUTE-PENDING\n"+runId+"\n").getBytes(StandardCharsets.US_ASCII);try{store.exclusivePassportMarker(directory,marker,()->{});}finally{Arrays.fill(marker,(byte)0);}}require(store.passportPending(directory).isFile());boolean denied=false;try{store.noPendingOperations(directory);}catch(Exception unavailable){denied=true;}require(denied);return true;}});}


    /** Independent canonical reading ledger; localized text and audio time are never stored. */
    private static final class ReadingEntry {final long revision;final PlanetChildReadingPosition.Record position;ReadingEntry(long revision,PlanetChildReadingPosition.Record position){this.revision=revision;this.position=position;}}
    static final class ReadingResult implements AutoCloseable {
        final String profileId;final long revision;final PlanetChildReadingPosition.Record position;private boolean closed;
        private ReadingResult(String profile,long revision,PlanetChildReadingPosition.Record position){profileId=profile;this.revision=revision;this.position=position;}
        synchronized Map<String,Object> dto() throws Exception {require(!closed);return exportRow("profileId",profileId,"revision",revision,"position",position==null?null:position.dto());}
        synchronized boolean closedForSDK(){return closed;}public synchronized void close(){closed=true;}
    }
    private static void validateReading(State state)throws Exception {
        if(!state.sdkReading){require(state.reading.isEmpty());return;}require(state.sdkPassport&&state.downloads.present&&state.admissionBinding!=null&&state.sdkUnboundBirth==null&&state.reading.size()<=4&&state.seals.keySet().containsAll(state.reading.keySet()));
        for(Map.Entry<String,TreeMap<String,ReadingEntry>> profile:state.reading.entrySet()){require(identifier(profile.getKey())&&!profile.getValue().isEmpty()&&profile.getValue().size()<=512);for(Map.Entry<String,ReadingEntry> row:profile.getValue().entrySet()){ReadingEntry entry=row.getValue();require(entry.revision>0&&entry.revision<MAX_SAFE&&row.getKey().equals(entry.position.key())&&PlanetChildReadingPosition.decode(entry.position.dto()).equals(entry.position));}}
    }
    private static void encodeReading(State state,DataOutputStream out)throws Exception {
        validateReading(state);if(!state.sdkReading)return;out.writeInt(0x4c505231);out.writeByte(1);out.writeByte(state.reading.size());for(Map.Entry<String,TreeMap<String,ReadingEntry>> profile:state.reading.entrySet()){out.writeUTF(profile.getKey());out.writeShort(profile.getValue().size());for(ReadingEntry row:profile.getValue().values()){out.writeLong(row.revision);out.writeUTF(row.position.kind);out.writeUTF(row.position.id);out.writeLong(row.position.anchorVersion);out.writeUTF(row.position.anchorId);}}
    }
    private static void decodeReading(State state,DataInputStream in)throws Exception {
        require(in.readInt()==0x4c505231&&in.readUnsignedByte()==1&&state.sdkPassport&&state.downloads.present);state.sdkReading=true;int count=in.readUnsignedByte();require(count<=4);
        for(int i=0;i<count;i++){String profile=in.readUTF();int n=in.readUnsignedShort();require(n>0&&n<=512&&!state.reading.containsKey(profile));TreeMap<String,ReadingEntry> rows=new TreeMap<>();for(int j=0;j<n;j++){long revision=in.readLong();PlanetChildReadingPosition.Record record=new PlanetChildReadingPosition.Record(in.readUTF(),in.readUTF(),in.readLong(),in.readUTF());require(!rows.containsKey(record.key()));rows.put(record.key(),new ReadingEntry(revision,record));}state.reading.put(profile,rows);}validateReading(state);
    }
    private static void migrateReading(State state)throws Exception {validateReading(state);require(sealBindings(state).keySet().containsAll(state.reading.keySet()));}
    private File readingPending(File directory)throws Exception {File file=new File(directory,"local-v2-reading.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void exclusiveReadingMarker(File directory,byte[] marker,Check check)throws Exception {require(marker!=null&&marker.length>0&&marker.length<=4096);check.check();FileDescriptor fd=Os.open(readingPending(directory).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);try{int at=0;while(at<marker.length){check.check();int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);}
    private byte[] readingMarkerBytes(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId,ReadingEntry entry)throws Exception {return ("LP-LOCAL-V2-READING\n"+identity+"\n"+commandId+"\n"+admission.binding()+"\n"+lease.scope.profileId+"\n"+lease.generation+"\n"+lease.nonce+"\n"+entry.revision+"\n"+entry.position.key()+"\n"+entry.position.anchorVersion+"\n"+entry.position.anchorId+"\n").getBytes(StandardCharsets.US_ASCII);}
    ReadingResult admittedReading(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String key,Long expected,PlanetChildVault.LocalV2ReadingPermit permit,String commandId)throws Exception {
        require((expected==null)==(permit==null)&&commandId!=null&&commandId.matches("[a-f0-9]{32}"));return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);validateReading(state);String profile=lease.scope.profileId;TreeMap<String,ReadingEntry> rows=state.reading.get(profile);ReadingEntry prior=rows==null?null:rows.get(key);long revision=prior==null?0:prior.revision;
            if(permit==null){ReadingResult result=new ReadingResult(profile,revision,prior==null?null:prior.position);try{admission.check();return result;}catch(Exception failure){result.close();throw failure;}}
            require(expected==revision&&profile.equals(permit.profileId(admission)));if(prior!=null)permit.prior(admission,prior.position);PlanetChildReadingPosition.Record record=permit.position(admission);require(key.equals(record.key()));long next=PlanetChildAppearance.next(revision);rows=rows==null?new TreeMap<>():new TreeMap<>(rows);rows.put(key,new ReadingEntry(next,record));require(rows.size()<=512);state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true;state.downloads.present=true;state.sdkReading=true;state.reading.put(profile,rows);byte[] prepared=encode(state),marker=readingMarkerBytes(admission,lease,commandId,rows.get(key));boolean attempted=false;
            try{attempted=true;exclusiveReadingMarker(directory,marker,()->permit.check(admission));write(directory,state,()->permit.check(admission));try(State actual=read(directory)){admittedLive(admission,lease,actual);permit.check(admission);ReadingEntry saved=actual.reading.get(profile).get(key);require(saved.revision==next&&saved.position.equals(record));byte[] after=encode(actual);try{require(MessageDigest.isEqual(prepared,after));}finally{Arrays.fill(after,(byte)0);}}byte[] pending=boundedRegular(readingPending(directory),4096);try{require(MessageDigest.isEqual(marker,pending));}finally{Arrays.fill(pending,(byte)0);}admission.readingCommandKnown(commandId);ReadingResult result=new ReadingResult(profile,next,record);try{admission.readingCommandReady(commandId);return result;}catch(Exception failure){result.close();throw failure;}
            }catch(Throwable failure){if(attempted)closed=true;if(failure instanceof Error)throw (Error)failure;throw (Exception)failure;}finally{Arrays.fill(prepared,(byte)0);Arrays.fill(marker,(byte)0);}
        }});
    }
    ReadingCompletion readingComplete(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,String commandId,String key)throws Exception {
        return locked(directory->{admission.check();try(State state=read(directory)){admittedLive(admission,lease,state);validateReading(state);admission.readingCommandJoined(commandId);ReadingEntry row=state.reading.get(lease.scope.profileId).get(key);require(row!=null);byte[] actual=boundedRegular(readingPending(directory),4096),expected=readingMarkerBytes(admission,lease,commandId,row);try{require(MessageDigest.isEqual(actual,expected));admission.check();return new ReadingCompletion(this,expected);}finally{Arrays.fill(actual,(byte)0);Arrays.fill(expected,(byte)0);}}});
    }    static final class ReadingCompletion implements AutoCloseable {
        private final PlanetChildDataStore store;private final byte[] marker;private boolean closed,completed;
        private ReadingCompletion(PlanetChildDataStore store,byte[] marker){this.store=store;this.marker=marker.clone();}
        synchronized void complete() throws Exception {require(!closed&&!completed);store.locked(directory->{require(!store.closed);File file=store.readingPending(directory);byte[] actual=store.boundedRegular(file,4096);try{require(MessageDigest.isEqual(actual,marker));Os.remove(file.getPath());store.syncBirthDirectory(directory);return null;}finally{Arrays.fill(actual,(byte)0);}});completed=true;}
        synchronized void retainUnknown() throws Exception {require(!closed);store.locked(directory->{File file=store.readingPending(directory);if(!file.exists())store.exclusiveReadingMarker(directory,marker,()->{});store.closed=true;return null;});}
        public synchronized void close(){closed=true;Arrays.fill(marker,(byte)0);}
    }

    /** Synthetic codec/partition fixtures only; never issues a CHILD permit. */
    static boolean fixtureReadingScenario(Context context,String name)throws Exception {
        fixtureAppearanceContext(context);require(Arrays.asList("legacy","codec","migration","history","profile","downloads","capacity","unknown-anchor").contains(name));
        try(State state=fixtureAppearanceState()){
            if("legacy".equals(name)){byte[] before=encode(state);try(State after=decode(before)){byte[] exact=encode(after);try{require(!after.sdkReading&&after.reading.isEmpty()&&Arrays.equals(before,exact));return true;}finally{Arrays.fill(exact,(byte)0);}}finally{Arrays.fill(before,(byte)0);}}
            String first="fixture-reader-one",second="fixture-reader-two";PlanetChildReadingPosition.Record a=new PlanetChildReadingPosition.Record("work","Work.ONE",1,"Passage.ONE"),b=new PlanetChildReadingPosition.Record("writer","Writer.TWO",2,"Passage.TWO");TreeMap<String,ReadingEntry> one=new TreeMap<>(),two=new TreeMap<>();one.put(a.key(),new ReadingEntry(7,a));two.put(b.key(),new ReadingEntry(11,b));state.sdkCollections=true;state.sdkAppearance=true;state.sdkJourney=true;state.sdkPassport=true;state.downloads.present=true;state.sdkReading=true;state.reading.put(first,one);state.reading.put(second,two);
            byte[] original=encode(state);try(State restored=decode(original)){
                require(restored.reading.get(first).get(a.key()).position.equals(a)&&restored.reading.get(second).get(b.key()).revision==11);
                if("migration".equals(name)){migrateReading(restored);require(restored.reading.get(first).get(a.key()).revision==7&&restored.reading.get(second).get(b.key()).position.equals(b));}
                if(Arrays.asList("history","profile","downloads").contains(name)){TreeMap<String,ReadingEntry> sibling=restored.reading.get(second),selected=restored.reading.get(first);removeOwnedState(restored,first,name);require(restored.reading.get(second)==sibling);require("downloads".equals(name)?restored.reading.get(first)==selected:!restored.reading.containsKey(first));validateReading(restored);}
                if("capacity".equals(name)){TreeMap<String,ReadingEntry> rows=new TreeMap<>();for(int i=0;i<512;i++){PlanetChildReadingPosition.Record record=new PlanetChildReadingPosition.Record("work","Entry."+i,1,"Anchor");rows.put(record.key(),new ReadingEntry(i+1,record));}restored.reading.put(first,rows);byte[] bounded=encode(restored);try(State retained=decode(bounded)){PlanetChildReadingPosition.Record extra=new PlanetChildReadingPosition.Record("work","Entry.EXTRA",1,"Anchor");rows.put(extra.key(),new ReadingEntry(513,extra));boolean refused=false;try{byte[] invalid=encode(restored);Arrays.fill(invalid,(byte)0);}catch(Exception denial){refused=true;}require(refused&&retained.reading.get(first).size()==512);byte[] exact=encode(retained);try{require(Arrays.equals(bounded,exact));}finally{Arrays.fill(exact,(byte)0);}}finally{Arrays.fill(bounded,(byte)0);}}
                if("unknown-anchor".equals(name)){Map<String,Object> anchors=PlanetChildReadingPosition.row("schemaVersion",1L,"anchorVersion",2L,"segments",Arrays.asList(PlanetChildReadingPosition.row("anchorId","Passage.NEW","text","New text")),"narration",null),reference=PlanetChildReadingPosition.row("kind","work","id","Work.ONE","contentChecksum","a".repeat(64));boolean refused=false;try{PlanetChildReadingPosition.membership(a,reference,anchors,"New text");}catch(Exception denied){refused=true;}require(refused);byte[] exact=encode(restored);try{require(Arrays.equals(original,exact)&&restored.reading.get(first).get(a.key()).position.equals(a));}finally{Arrays.fill(exact,(byte)0);}}
                return true;
            }finally{Arrays.fill(original,(byte)0);}
        }
    }}
