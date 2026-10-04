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
        public void close() { for (Stored slot : entries.values()) Arrays.fill(slot.value, (byte) 0); }
    }
    PlanetChildDataStore(Context context) throws Exception { this(context, null); }
    static PlanetChildDataStore synthetic(Context context, String runId) throws Exception {
        require(context != null && "ru.probpera.literaryplanet.dev".equals(context.getPackageName())
            && (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 && runId != null && runId.matches("[a-f0-9]{32}"));
        return new PlanetChildDataStore(context, runId);
    }
    private PlanetChildDataStore(Context input, String runId) throws Exception {
        require(input != null); context = input.getApplicationContext(); require(context != null
            && context.getPackageName().matches("ru\\.probpera\\.literaryplanet(?:\\.dev|\\.rustore)?"));
        name = "literary-planet-child-data-v1" + (runId == null ? "" : "-synthetic-" + runId);
        identity = context.getPackageName() + "." + name;
        locked(directory -> { if(runId==null)existingOnly(directory);else initialize(directory); return null; });
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
        exact(payload,"title","text","terms","references"); String title=text(payload.get("title")),body=text(payload.get("text"));
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
    private static void validateSeals(State state) throws Exception {if(state.admissionBinding==null){require(state.seals.isEmpty()&&state.pendingMigration==null);return;}require((state.pendingMigration==null||checksum(state.pendingMigration))&&checksum(state.admissionBinding)&&!state.seals.isEmpty()&&state.seals.size()<=4);for(Map.Entry<String,Seal> item:state.seals.entrySet())require(item.getKey().equals(item.getValue().scope.profileId)&&checksum(item.getValue().contentBinding));if(state.scope!=null){Seal selected=state.seals.get(state.scope.profileId);require(selected!=null&&state.scope.tuple.equals(selected.scope.tuple));}for(String compound:state.entries.keySet()){int split=compound.indexOf('\n');Scope saved=keyScope(Purpose.valueOf(compound.substring(0,split)),compound.substring(split+1));Seal seal=state.seals.get(saved.profileId);require(seal!=null&&saved.tuple.equals(seal.scope.tuple));}}
    private static byte[] encode(State state) throws Exception {validateSeals(state);
        try(WipingBytes bytes=new WipingBytes()) { DataOutputStream out=new DataOutputStream(bytes);
        out.writeInt(0x4c504431); out.writeLong(state.generation); out.writeUTF(state.nonce); out.writeBoolean(state.scope!=null); if(state.scope!=null) out.writeUTF(state.scope.tuple);
        require(state.entries.size()<=MAX_SLOTS); out.writeInt(state.entries.size());
        for(Map.Entry<String,Stored> entry:state.entries.entrySet()) { String compound=entry.getKey(); int split=compound.indexOf('\n'); Purpose purpose=Purpose.valueOf(compound.substring(0,split)); String key=compound.substring(split+1);
            Stored stored=entry.getValue(); Scope scope=keyScope(purpose,key); envelope(purpose,key,scope,stored.value); require(positive(stored.revision) && stored.revision < MAX_SAFE);
            out.writeByte(purpose.ordinal()); out.writeUTF(key); out.writeLong(stored.revision); out.writeUTF(digest(stored.value)); out.writeInt(stored.value.length); out.write(stored.value);
            require(bytes.size()<=MAX_SNAPSHOT_BYTES); }
        if(state.admissionBinding!=null){out.writeInt(0x4c504133);out.writeUTF(state.admissionBinding);out.writeBoolean(state.pendingMigration!=null);if(state.pendingMigration!=null)out.writeUTF(state.pendingMigration);out.writeInt(state.seals.size());for(Seal seal:state.seals.values()){out.writeUTF(seal.scope.tuple);out.writeUTF(seal.contentBinding);}}
        out.flush(); byte[] result=bytes.toByteArray(); require(result.length<=MAX_SNAPSHOT_BYTES); return result; }
    }
    private static State decode(byte[] bytes) throws Exception {
        State state=new State(); boolean successful=false; try { DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes)); require(in.readInt()==0x4c504431);
            state.generation=in.readLong(); require(state.generation>=0 && state.generation<MAX_SAFE); state.nonce=in.readUTF(); require(state.nonce.matches("[a-f0-9]{32}"));
            int flag=in.readUnsignedByte(); require(flag==0 || flag==1); if(flag==1) state.scope=Scope.decode(in.readUTF()); int count=in.readInt(); require(count>=0 && count<=MAX_SLOTS);
            for(int i=0;i<count;i++) { int rawPurpose=in.readUnsignedByte(); require(rawPurpose<Purpose.values().length); Purpose purpose=Purpose.values()[rawPurpose]; String key=in.readUTF(); Scope scope=keyScope(purpose,key);
                long revision=in.readLong(); require(positive(revision) && revision < MAX_SAFE); String hash=in.readUTF(); require(checksum(hash)); int length=in.readInt(); require(length>0 && length<=MAX_VALUE_BYTES && length<=in.available());
                byte[] value=new byte[length]; boolean owned=false; try { in.readFully(value); require(digest(value).equals(hash)); envelope(purpose,key,scope,value);
                    require(!state.entries.containsKey(purpose.name()+"\n"+key)); state.entries.put(purpose.name()+"\n"+key,new Stored(revision,value)); owned=true; } finally { if(!owned) Arrays.fill(value,(byte)0); } }
            if(in.available()>0){require(in.readInt()==0x4c504133);state.admissionBinding=in.readUTF();require(checksum(state.admissionBinding));int pending=in.readUnsignedByte();require(pending==0||pending==1);if(pending==1){state.pendingMigration=in.readUTF();require(checksum(state.pendingMigration));}int seals=in.readInt();require(seals>0&&seals<=4);for(int i=0;i<seals;i++){Scope saved=Scope.decode(in.readUTF());String content=in.readUTF();require(checksum(content)&&!state.seals.containsKey(saved.profileId));state.seals.put(saved.profileId,new Seal(saved,content));}}validateSeals(state);
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
    private static Map<String,String> sealBindings(State state){Map<String,String> result=new TreeMap<>();for(Map.Entry<String,Seal> entry:state.seals.entrySet())result.put(entry.getKey(),entry.getValue().contentBinding);return result;}
    private void admittedLive(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,State state) throws Exception {
        admittedState(admission,state);require(state.pendingMigration==null&&!closed&&active==lease&&lease!=null&&lease.owner==this&&lease.admission==admission&&state.scope!=null
            &&state.generation==lease.generation&&state.nonce.equals(lease.nonce)&&state.scope.tuple.equals(lease.scope.tuple));
    }
    Lease admit(PlanetChildVault.LocalV2DataAdmission admission) throws Exception {require(admission!=null);return locked(directory->{admission.check();existingOnly(directory);require(!closed&&active==null);try(State state=read(directory)){
        require(state.scope==null&&state.pendingMigration==null);PlanetChildVault.LocalV2KnownBirth birth=knownBirth(directory);admission.retainedBirth(birth);Scope current=admission.scope();require(current!=null);
        if(state.admissionBinding==null){require(admission.initialProfile()&&state.seals.isEmpty()&&state.generation==0&&state.entries.isEmpty()&&state.nonce.equals(birth.nonce));byte[] empty=encode(state);try{require(digest(empty).equals(birth.emptyChecksum));}finally{Arrays.fill(empty,(byte)0);}state.admissionBinding=admission.binding();state.seals.put(current.profileId,new Seal(current,admission.contentBinding()));}
        else require(state.admissionBinding.equals(admission.binding())&&state.seals.containsKey(current.profileId));admittedState(admission,state);
        for(Map.Entry<String,Stored> entry:state.entries.entrySet()){int split=entry.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(entry.getKey().substring(0,split));String key=entry.getKey().substring(split+1);if(keyScope(purpose,key).profileId.equals(current.profileId))admission.validate(purpose,key,entry.getValue().value);}
        require(state.generation<MAX_SAFE-1);state.generation++;state.nonce=nonce();state.scope=current;write(directory,state,admission::check);admittedState(admission,state);
        Lease lease=new Lease(this,state.scope,state.generation,state.nonce,admission);active=lease;return lease;
    }});}
    Cancellation admittedOperation(PlanetChildVault.LocalV2DataAdmission admission,Lease lease) throws Exception {return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){
        admittedLive(admission,lease,state);long now=SystemClock.elapsedRealtime(),deadline=admission.deadline();require(now>=0&&now<deadline&&deadline-now<=60000);return new Cancellation(this,lease,deadline);
    }});}
    Slot admittedQuery(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,Result original,Purpose purpose,String key) throws Exception {return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){admittedLive(admission,lease,state);require(keyScope(purpose,key).tuple.equals(lease.scope.tuple));Slot captured=original.get(purpose,key);require(captured!=null);Stored saved=state.entries.get(purpose.name()+"\n"+key);require(captured.revision==(saved==null?0:saved.revision)&&Objects.equals(captured.checksum,saved==null?null:digest(saved.value)));if(saved!=null)admission.validate(purpose,key,saved.value);Slot copied=new Slot(saved==null?0:saved.revision,saved==null?null:saved.value);try{admission.check();return copied;}catch(Exception failure){copied.close();throw failure;}}});}
    private void admittedCheck(PlanetChildVault.LocalV2DataAdmission admission,Cancellation cancellation,Lease lease,State state) throws Exception {admittedLive(admission,lease,state);require(cancellation.owner==this&&cancellation.lease==lease&&cancellation.used&&!cancellation.cancelled&&!Thread.currentThread().isInterrupted()&&SystemClock.elapsedRealtime()<cancellation.deadline&&cancellation.deadline==admission.deadline());unlocked();}
    Result admittedTransact(PlanetChildVault.LocalV2DataAdmission admission,Lease lease,List<ReadKey> reads,List<Mutation> writes,Cancellation cancellation) throws Exception {
        require(admission!=null&&reads!=null&&writes!=null&&reads.size()<=MAX_BATCH&&writes.size()<=MAX_BATCH&&cancellation!=null);List<ReadKey> ownedReads=new ArrayList<>(reads);List<Mutation> ownedWrites=new ArrayList<>(writes);List<byte[]> values=new ArrayList<>();
        try{int size=0;for(Mutation write:ownedWrites){require(write!=null);byte[] bytes=write.copy(MAX_SNAPSHOT_BYTES-size);values.add(bytes);size+=bytes.length;}
            return locked(directory->{admission.check();existingOnly(directory);try(State state=read(directory)){require(!cancellation.used);cancellation.used=true;admittedCheck(admission,cancellation,lease,state);Set<String> readIds=new HashSet<>(),writeIds=new HashSet<>();Map<String,Slot> result=new LinkedHashMap<>();boolean handed=false;
                try{for(ReadKey read:ownedReads){require(read!=null&&keyScope(read.purpose,read.key).tuple.equals(lease.scope.tuple));String id=read.purpose.name()+"\n"+read.key;require(readIds.add(id));Stored saved=state.entries.get(id);if(saved!=null)admission.validate(read.purpose,read.key,saved.value);}
                    for(int i=0;i<ownedWrites.size();i++){Mutation write=ownedWrites.get(i);require(keyScope(write.purpose,write.key).tuple.equals(lease.scope.tuple));String id=write.purpose.name()+"\n"+write.key;require(writeIds.add(id));Stored old=state.entries.get(id);require((old==null?0:old.revision)==write.expectedRevision);envelope(write.purpose,write.key,lease.scope,values.get(i));admission.validate(write.purpose,write.key,values.get(i));}
                    for(ReadKey read:ownedReads){String id=read.purpose.name()+"\n"+read.key;Stored saved=state.entries.get(id);result.put(id,new Slot(saved==null?0:saved.revision,saved==null?null:saved.value));}
                    for(int i=0;i<ownedWrites.size();i++){Mutation write=ownedWrites.get(i);String id=write.purpose.name()+"\n"+write.key;Stored replaced=state.entries.put(id,new Stored(write.expectedRevision+1,values.get(i).clone()));if(replaced!=null)Arrays.fill(replaced.value,(byte)0);}
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
        require(state.scope==null&&state.pendingMigration==null&&state.admissionBinding!=null&&state.admissionBinding.equals(admission.previousBinding()));admission.retainedBirth(knownBirth(directory));admission.previousSeals(sealBindings(state));Scope future=admission.scope();
        if(future!=null){Seal previous=state.seals.get(future.profileId);if(admission.createsProfile())require(previous==null&&state.seals.size()<4);else require(previous!=null&&previous.contentBinding.equals(admission.previousContentBinding()));}
        TreeMap<String,Stored> next=new TreeMap<>();boolean adopted=false;try{for(Map.Entry<String,Stored> entry:state.entries.entrySet()){admission.check();int split=entry.getKey().indexOf('\n');Purpose purpose=Purpose.valueOf(entry.getKey().substring(0,split));String oldKey=entry.getKey().substring(split+1);Scope oldScope=keyScope(purpose,oldKey);Seal oldSeal=state.seals.get(oldScope.profileId);require(oldSeal!=null&&oldScope.tuple.equals(oldSeal.scope.tuple));try(PlanetChildVault.LocalV2MigrationValue value=future==null?null:admission.partition(purpose,oldKey,entry.getValue().value)){if(future==null){require(!next.containsKey(entry.getKey()));next.put(entry.getKey(),new Stored(entry.getValue().revision,entry.getValue().value.clone()));continue;}if(value==null)continue;Scope nextScope=value.changed?future:oldScope;envelope(purpose,value.key,nextScope,value.bytes);if(value.changed)admission.validate(purpose,value.key,value.bytes);long revision=entry.getValue().revision;require(!value.changed||revision<MAX_SAFE-1);String id=purpose.name()+"\n"+value.key;require(!next.containsKey(id));next.put(id,new Stored(revision+(value.changed?1:0),value.bytes.clone()));}}
            if(future!=null)state.seals.put(future.profileId,new Seal(future,admission.contentBinding()));require(state.generation<MAX_SAFE-1);state.generation++;state.nonce=nonce();state.admissionBinding=admission.binding();state.pendingMigration=admission.migrationIdentity();state.close();state.entries.clear();state.entries.putAll(next);adopted=true;
            admission.markDataWrite();pendingMigrationFile(directory,state.pendingMigration);write(directory,state,admission::check);admission.commitCanonical();admittedState(admission,state);return null;
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
                Os.unlink(migrationPending(directory).getPath());syncBirthDirectory(directory);closed=true;return null;
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
    private void existingOnly(File directory) throws Exception {existingRecord(directory);require(!knownPending(directory).exists()&&!migrationPending(directory).exists());knownBirth(directory);}
    private File migrationPending(File directory) throws Exception {File file=new File(directory,"local-v2-migration.pending");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));return file;}
    private void pendingMigrationFile(File directory,String identity) throws Exception {
        require(identity!=null&&identity.matches("[a-f0-9]{64}"));File file=migrationPending(directory);byte[] marker=identity.getBytes(StandardCharsets.US_ASCII);
        try{if(file.exists()){byte[] actual=boundedRegular(file,64);try{require(MessageDigest.isEqual(actual,marker));}finally{Arrays.fill(actual,(byte)0);}return;}
            FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
            try{int at=0;while(at<marker.length){int n=Os.write(fd,marker,at,marker.length-at);require(n>0);at+=n;}Os.fsync(fd);}finally{Os.close(fd);}syncBirthDirectory(directory);
        }finally{Arrays.fill(marker,(byte)0);}
    }
    private void existingMigration(File directory,PlanetChildVault.LocalV2DataAdmission admission) throws Exception {
        existingRecord(directory);require(!knownPending(directory).exists());knownBirth(directory);byte[] actual=boundedRegular(migrationPending(directory),64);
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
            permit.dataCompletionBoundary();Os.unlink(knownPending(directory).getPath());syncBirthDirectory(directory);
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
}
