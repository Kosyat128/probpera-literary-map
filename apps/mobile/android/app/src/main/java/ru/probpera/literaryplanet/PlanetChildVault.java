package ru.probpera.literaryplanet;

import android.app.KeyguardManager;
import android.content.Context;
import android.os.SystemClock;
import android.system.Os;
import android.system.OsConstants;
import android.system.StructStat;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Dedicated child full-record candidate storage; no CAP/plugin registration.
 * AES-GCM/AtomicFile/flock alone are NOT a ParentPinSecureStore or checkpoint.
 * Only cooperating native clients are serialized. App/content rollback remains
 * unadmitted until a genuine checkpoint+native action permission is installed.
 * No enrollment, reset, key regeneration, recovery or adult-mode fallback. */
final class PlanetChildVault {
    static final int MAX_BYTES = 131072;
    private static final long MAX_SAFE = 9007199254740991L;
    private static final ReentrantLock PROCESS_LOCK = new ReentrantLock();
    private final Context context;
    private final String vaultIdentity;
    private final VerifiedCheckpoint checkpoint;
    static final class Unavailable extends Exception {
        Unavailable() { super("child-protected-state-unavailable"); }
    }
    static final class BootSample {
        final String bootId;
        final long uptimeMs;
        private BootSample(String bootId, long uptimeMs) { this.bootId = bootId; this.uptimeMs = uptimeMs; }
    }
    static final class CandidateSnapshot {
        private final byte[] record;
        private boolean disposed;
        final String checksum;
        final BootSample sample;
        private CandidateSnapshot(byte[] record, BootSample sample) throws Exception {
            this.record = record.clone(); this.checksum = digest(record); this.sample = sample;
        }
        synchronized byte[] copyRecord() throws Unavailable { require(!disposed); return record.clone(); }
        synchronized void dispose() { disposed = true; Arrays.fill(record, (byte) 0); }
    }
    static final class CasRequest {
        private final byte[] expected, next;
        final String expectedChecksum, nextChecksum, bootId;
        final long deadlineUptimeMs;
        private boolean disposed;
        CasRequest(byte[] expected, byte[] next, String expectedChecksum, String nextChecksum,
                   String bootId, long deadlineUptimeMs) throws Exception {
            require(expected != null && next != null && expected.length > 0 && expected.length <= MAX_BYTES && next.length > 0 && next.length <= MAX_BYTES);
            this.expected = expected.clone(); this.next = next.clone();
            try {
                validRecord(this.expected); validRecord(this.next);
                require(digest(this.expected).equals(expectedChecksum) && digest(this.next).equals(nextChecksum)
                    && validBoot(bootId) && deadlineUptimeMs >= 0 && deadlineUptimeMs <= MAX_SAFE);
            } catch (Exception failure) { Arrays.fill(this.expected, (byte) 0); Arrays.fill(this.next, (byte) 0); throw new Unavailable(); }
            this.expectedChecksum = expectedChecksum; this.nextChecksum = nextChecksum;
            this.bootId = bootId; this.deadlineUptimeMs = deadlineUptimeMs;
        }
        private synchronized CasRequest claim() throws Exception {
            require(!disposed); CasRequest owned = new CasRequest(expected, next, expectedChecksum, nextChecksum, bootId, deadlineUptimeMs);
            dispose(); return owned;
        }
        synchronized void dispose() { disposed = true; Arrays.fill(expected, (byte) 0); Arrays.fill(next, (byte) 0); }
    }
    /** No public/package initializer: JS, flags and mock constructor witnesses
     * cannot mint this permission. A future actual native adapter must verify
     * the exact protected action/target and create it in the trusted factory. */
    static final class NativeMutationPermission {
        private final VerifiedCheckpoint owner;
        private final String vaultIdentity, expectedChecksum, nextChecksum, action, bootId;
        private final long deadlineUptimeMs;
        private boolean consumed;
        private volatile boolean cancelled;
        private NativeMutationPermission(VerifiedCheckpoint owner, String vaultIdentity,
            String expectedChecksum, String nextChecksum, String action, String bootId, long deadlineUptimeMs) {
            this.owner = owner; this.vaultIdentity = vaultIdentity; this.expectedChecksum = expectedChecksum;
            this.nextChecksum = nextChecksum; this.action = action; this.bootId = bootId;
            this.deadlineUptimeMs = deadlineUptimeMs;
        }
        void cancel() { cancelled = true; } // Revocation only; cannot mint/re-enable.
    }
    /** Constructor-owned, internally admitted SPI, not a boolean capability.
     * verifyCurrent authenticates the installed vault and nonrollback digest.
     * advance durably consumes exact action permission and moves the checkpoint
     * BEFORE record publication. Divergence after crash/unknown ack denies.
     * No adapter/constructor accepting arbitrary external SPI is exposed. */
    private abstract static class VerifiedCheckpoint {
        private VerifiedCheckpoint() {}
        abstract void verifyCurrent(String vaultIdentity, String digest) throws Exception;
        abstract void advance(NativeMutationPermission permission) throws Exception;
    }
    private static VerifiedCheckpoint actualSdkCheckpoint(Context context) {
        // Ordinary AndroidKeystore AES does not prove this required checkpoint.
        // No SDK/device guarantee has been admitted. Do not fabricate a witness.
        return null;
    }
    PlanetChildVault(Context context) throws Exception {
        require(context != null); this.context = context.getApplicationContext();
        require(this.context != null && this.context.getPackageName().matches("ru\\.probpera\\.literaryplanet(?:\\.dev|\\.rustore)?"));
        vaultIdentity = this.context.getPackageName() + ".literary-planet-child-full-record-v1";
        checkpoint = actualSdkCheckpoint(this.context);
    }
    private static void require(boolean condition) throws Unavailable { if (!condition) throw new Unavailable(); }
    private static boolean validBoot(String value) {
        return value != null && value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}");
    }
    private static void validRecord(byte[] value) throws Exception {
        require(value != null && value.length > 0 && value.length <= MAX_BYTES);
        StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(value));
    }
    private static String digest(byte[] value) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(value);
        StringBuilder result = new StringBuilder(64); final char[] hex = "0123456789abcdef".toCharArray();
        for (byte item : hash) { result.append(hex[(item & 255) >>> 4]); result.append(hex[item & 15]); }
        Arrays.fill(hash, (byte) 0); return result.toString();
    }
    private void unlocked() throws Exception {
        KeyguardManager manager = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        require(manager != null && !manager.isDeviceLocked());
    }
    /** Fixed native/kernel read only. Denial by SELinux/SDK is unavailable,
     * never a generated token, BOOT_COUNT or user-adjustable wall timestamp. */
    private static BootSample bootSample() throws Exception {
        byte[] bytes = new byte[65]; int total = 0;
        try (FileInputStream input = new FileInputStream("/proc/sys/kernel/random/boot_id")) {
            while (total < bytes.length) { int count = input.read(bytes, total, bytes.length - total); if (count < 0) break; total += count; }
            require(total > 0 && total <= 64);
            String value = new String(bytes, 0, total, StandardCharsets.US_ASCII);
            require(value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\n?"));
            String boot = value.endsWith("\n") ? value.substring(0, value.length() - 1) : value;
            long uptime = SystemClock.elapsedRealtime(); require(uptime >= 0 && uptime <= MAX_SAFE);
            return new BootSample(boot, uptime); // Includes deep sleep, same boot only.
        } finally { Arrays.fill(bytes, (byte) 0); }
    }
    private File directory() throws Exception {
        File parent = context.getNoBackupFilesDir().getCanonicalFile();
        File directory = new File(parent, "literary-planet-child-vault-v1");
        require(directory.getAbsoluteFile().equals(directory.getCanonicalFile()));
        require(directory.isDirectory() || directory.mkdir());
        require(directory.isDirectory() && directory.getCanonicalFile().getParentFile().equals(parent)); return directory;
    }
    private AtomicFile record(File directory) throws Exception {
        File file = new File(directory, "full-record-v1");
        for (String suffix : new String[] { "", ".bak", ".new" }) {
            File candidate = new File(file.getPath() + suffix);
            require(candidate.getAbsoluteFile().equals(candidate.getCanonicalFile()));
            if (candidate.exists()) { StructStat stat = Os.lstat(candidate.getPath()); require(OsConstants.S_ISREG(stat.st_mode) && stat.st_size <= MAX_BYTES + 29); }
        }
        return new AtomicFile(file);
    }
    private SecretKey existingKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        String alias = vaultIdentity + ".aes"; require(store.containsAlias(alias));
        java.security.Key key = store.getKey(alias, null); require(key instanceof SecretKey); return (SecretKey) key;
    }
    private byte[] readExact(File directory) throws Exception {
        unlocked(); AtomicFile record = record(directory);
        require(record.getBaseFile().exists() || new File(record.getBaseFile().getPath() + ".bak").exists());
        byte[] encoded = record.readFully(), plaintext = null;
        try {
            require(encoded.length >= 30 && encoded.length <= MAX_BYTES + 29 && encoded[0] == 1);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, existingKey(), new GCMParameterSpec(128, Arrays.copyOfRange(encoded, 1, 13)));
            cipher.updateAAD(vaultIdentity.getBytes(StandardCharsets.UTF_8)); plaintext = cipher.doFinal(encoded, 13, encoded.length - 13);
            validRecord(plaintext); unlocked(); byte[] result = plaintext; plaintext = null; return result;
        } finally { Arrays.fill(encoded, (byte) 0); if (plaintext != null) Arrays.fill(plaintext, (byte) 0); }
    }
    private interface CommitCheck { void check() throws Exception; }
    private void writeExact(File directory, byte[] next, CommitCheck commitCheck) throws Exception {
        validRecord(next); unlocked(); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, existingKey()); byte[] iv = cipher.getIV(); require(iv != null && iv.length == 12);
        cipher.updateAAD(vaultIdentity.getBytes(StandardCharsets.UTF_8)); byte[] ciphertext = cipher.doFinal(next),encoded = null;
        try {
            encoded = ByteBuffer.allocate(13 + ciphertext.length).put((byte) 1).put(iv).put(ciphertext).array();
            AtomicFile file = record(directory); FileOutputStream stream = null; commitCheck.check();
            try { stream = file.startWrite(); stream.write(encoded); commitCheck.check(); stream.getFD().sync(); commitCheck.check(); file.finishWrite(stream); stream = null; }
            finally { if (stream != null) file.failWrite(stream); }
            FileDescriptor fd = Os.open(directory.getPath(), OsConstants.O_RDONLY | OsConstants.O_CLOEXEC, 0);
            try { require(OsConstants.S_ISDIR(Os.fstat(fd).st_mode)); Os.fsync(fd); } finally { Os.close(fd); }
            byte[] actual = readExact(directory); try { require(MessageDigest.isEqual(actual, next)); } finally { Arrays.fill(actual, (byte) 0); }
            commitCheck.check(); // Late abort/timeout cannot publish a parent proof.
        } finally { Arrays.fill(ciphertext, (byte) 0); if (encoded != null) Arrays.fill(encoded, (byte) 0); }
    }
    private interface LockedWork<T> { T run(File directory) throws Exception; }
    private <T> T locked(LockedWork<T> work) throws Exception {
        boolean processAcquired = false; long started = SystemClock.elapsedRealtime();
        try {
            processAcquired = PROCESS_LOCK.tryLock(1500, TimeUnit.MILLISECONDS); require(processAcquired);
            try {
                long acquiredAt = SystemClock.elapsedRealtime(); require(!Thread.currentThread().isInterrupted() && acquiredAt >= started && acquiredAt - started < 1500);
                File directory = directory(),file = new File(directory, "transaction.lock");
                require(file.getAbsoluteFile().equals(file.getCanonicalFile()));
                FileDescriptor fd = Os.open(file.getPath(), OsConstants.O_RDWR | OsConstants.O_CREAT | OsConstants.O_NOFOLLOW | OsConstants.O_CLOEXEC, 0600);
                try (FileOutputStream owner = new FileOutputStream(fd)) {
                    FileLock lock = null;
                    try {
                        while (lock == null) {
                            try { lock = owner.getChannel().tryLock(); } catch (OverlappingFileLockException busy) { /* Another cooperating classloader owns it. */ }
                            if (lock == null) { long now = SystemClock.elapsedRealtime(); require(now >= started && now - started < 1500); Thread.sleep(10); }
                        }
                        long acquiredFileAt = SystemClock.elapsedRealtime(); require(!Thread.currentThread().isInterrupted() && acquiredFileAt >= started && acquiredFileAt - started < 1500);
                        StructStat opened = Os.fstat(fd),named = Os.lstat(file.getPath());
                        require(OsConstants.S_ISREG(opened.st_mode) && opened.st_ino == named.st_ino && opened.st_dev == named.st_dev);
                        return work.run(directory);
                    } finally { if (lock != null) lock.release(); }
                }
            } catch (Exception failure) { if (failure instanceof InterruptedException) Thread.currentThread().interrupt(); throw new Unavailable(); }
        } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new Unavailable(); }
        finally { if (processAcquired) PROCESS_LOCK.unlock(); }
    }
    CandidateSnapshot readCandidate() throws Exception {
        return locked(directory -> { byte[] bytes = readExact(directory); try { return new CandidateSnapshot(bytes, bootSample()); } finally { Arrays.fill(bytes, (byte) 0); } });
    }
    String compareAndSetCandidate(CasRequest request) throws Exception {
        require(request != null); CasRequest owned = request.claim();
        try { return locked(directory -> { byte[] actual = readExact(directory); try {
            require(MessageDigest.isEqual(actual, owned.expected)); requireDeadline(owned);
            writeExact(directory, owned.next, () -> requireDeadline(owned)); return owned.nextChecksum;
        } finally { Arrays.fill(actual, (byte) 0); } }); } finally { owned.dispose(); }
    }
    private static void requireDeadline(CasRequest request) throws Exception {
        BootSample sample = bootSample(); require(sample.bootId.equals(request.bootId) && sample.uptimeMs < request.deadlineUptimeMs);
    }
    CandidateSnapshot readProtected() throws Exception {
        require(checkpoint != null);
        return locked(directory -> { byte[] actual = readExact(directory); try {
            checkpoint.verifyCurrent(vaultIdentity, digest(actual)); return new CandidateSnapshot(actual, bootSample());
        } finally { Arrays.fill(actual, (byte) 0); } });
    }
    String compareAndSetProtected(CasRequest request, NativeMutationPermission permission) throws Exception {
        require(checkpoint != null && request != null && permission != null);
        CasRequest owned = request.claim();
        try { return locked(directory -> {
            boolean alreadyConsumed = permission.consumed; permission.consumed = true;
            require(!alreadyConsumed && !permission.cancelled && permission.owner == checkpoint && permission.vaultIdentity.equals(vaultIdentity)
                && permission.expectedChecksum.equals(owned.expectedChecksum) && permission.nextChecksum.equals(owned.nextChecksum)
                && permission.bootId.equals(owned.bootId) && permission.deadlineUptimeMs == owned.deadlineUptimeMs
                && permission.action != null && permission.action.matches("[a-z][a-z0-9-]{0,63}"));
            byte[] actual = readExact(directory); try {
                require(MessageDigest.isEqual(actual, owned.expected)); requireDeadline(owned);
                checkpoint.verifyCurrent(vaultIdentity, owned.expectedChecksum); require(!permission.cancelled); requireDeadline(owned);
                checkpoint.advance(permission); // Actual nonrollback checkpoint first, never record-only CAS.
                checkpoint.verifyCurrent(vaultIdentity, owned.nextChecksum); require(!permission.cancelled); requireDeadline(owned);
                writeExact(directory, owned.next, () -> { require(!permission.cancelled); requireDeadline(owned); });
                checkpoint.verifyCurrent(vaultIdentity, owned.nextChecksum); require(!permission.cancelled); requireDeadline(owned);
                return owned.nextChecksum;
            } finally { Arrays.fill(actual, (byte) 0); }
        }); } finally { owned.dispose(); }
    }
}
