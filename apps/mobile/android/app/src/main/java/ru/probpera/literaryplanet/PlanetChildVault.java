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

    /** Pure structural codec only, deliberately unused by candidate/protected IO.
     * Parsed bytes/digests, this enum and successful validation confer no native
     * checkpoint, action permission, trusted time or child/admission authority. */
    enum PinLifecycleAction { enroll, replace, recover }
    static final class ProtectedEnvelope implements AutoCloseable {
        private static final long MAX_EPOCH = 8640000000000000L;
        private final byte[] canonical;
        private final int revisionEnd, pinStart, pinEnd;
        private final boolean unenrolled;
        private final long revision, pinRevision, lastObservedMs, count, blockedUntilMs, logicalAnchorMs;
        private final String credentialId, saltHex, pendingAttemptId, policyVersion, policyChecksum;
        private final long maximumIterations, iterations;
        final String checksum;
        private boolean disposed;
        private ProtectedEnvelope(byte[] owned, Cursor parsed, long revision, Pin pin, long logical,
                                  int revisionEnd, int pinStart, int pinEnd, String version, String policy, long maximum) throws Exception {
            canonical = owned; this.revision = revision; unenrolled = pin == null;
            pinRevision = pin == null ? 0 : pin.revision;
            lastObservedMs = pin == null ? 0 : pin.lastObservedMs;
            count = pin == null ? 0 : pin.count; blockedUntilMs = pin == null ? 0 : pin.blockedUntilMs;
            credentialId = pin == null ? null : pin.credentialId; saltHex = pin == null ? null : pin.saltHex;
            pendingAttemptId = pin == null ? null : pin.pendingAttemptId;
            iterations = pin == null ? 0 : pin.iterations; logicalAnchorMs = logical;
            this.revisionEnd = parsed.byteOffset(revisionEnd); this.pinStart = parsed.byteOffset(pinStart);
            this.pinEnd = parsed.byteOffset(pinEnd); policyVersion = version; policyChecksum = policy;
            maximumIterations = maximum; checksum = digest(owned);
        }
        /** Owns a copy, leaves caller bytes untouched. SHA is identity only.
         * JSON.stringify canonical order/escaping is checked by an ordered
         * schema grammar, never JSONObject/platform reserialization. */
        static ProtectedEnvelope decode(byte[] input, String version, String policy, long maximum) throws Exception {
            require(input != null && input.length > 0 && input.length <= MAX_BYTES && identifier(version)
                && hash(policy) && maximum >= 600000 && maximum <= 0xffffffffL);
            byte[] owned = input.clone();
            try {
                String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(owned)).toString();
                Cursor p = new Cursor(text);
                p.field("schemaVersion", true); p.number(1, 1);
                p.field("revision", false); long revision = p.number(1, MAX_SAFE); int revisionEnd = p.index;
                p.field("mode", false); String mode = p.string(); require(mode.equals("adult") || mode.equals("child"));
                p.field("selectionRevision", false); p.number(1, MAX_SAFE);
                p.field("profileRevision", false); p.number(1, MAX_SAFE);
                p.field("policyChecksum", false); require(p.string().equals(policy));
                p.field("registryChecksum", false); String registryChecksum = p.string(); require(hash(registryChecksum));
                p.field("registry", false); int registryStart = p.index;
                String activeProfile = registry(p, version); int registryEnd = p.index;
                byte[] registryBytes = text.substring(registryStart, registryEnd).getBytes(StandardCharsets.UTF_8);
                try { require(digest(registryBytes).equals(registryChecksum)); } finally { Arrays.fill(registryBytes, (byte) 0); }
                p.field("pin", false); int pinStart = p.index;
                Pin pin = p.take("null") ? null : pin(p, version, maximum); int pinEnd = p.index;
                p.field("clock", false); long logical = clock(p);
                p.token("}"); require(p.index == text.length() && (pin != null || mode.equals("adult"))
                    && (!mode.equals("child") || activeProfile != null) && (pin == null || pin.lastObservedMs >= logical));
                ProtectedEnvelope envelope = new ProtectedEnvelope(owned, p, revision, pin, logical, revisionEnd, pinStart, pinEnd, version, policy, maximum);
                owned = null; return envelope;
            } finally { if (owned != null) Arrays.fill(owned, (byte) 0); }
        }
        synchronized boolean isUnenrolled() throws Exception { require(!disposed); return unenrolled; }
        synchronized byte[] copyCanonicalBytes() throws Exception { require(!disposed); return canonical.clone(); }
        public synchronized void close() { disposed = true; Arrays.fill(canonical, (byte) 0); }
        /** Structural PIN-only transition. sampledLogicalMs is an explicit
         * comparison value, NOT trusted time or authorization minted by this
         * codec. Future owned native provider must authenticate it/permission
         * and exact calibrated iterations independently under the durable lock. */
        static void validateTransition(ProtectedEnvelope before, ProtectedEnvelope after, PinLifecycleAction action, long sampledLogicalMs) throws Exception {
            require(before != null && after != null && action != null && sampledLogicalMs >= 0 && sampledLogicalMs <= MAX_SAFE);
            byte[] oldBytes = before.copyCanonicalBytes(), nextBytes = null;
            try {
                nextBytes = after.copyCanonicalBytes();
                require(before.policyVersion.equals(after.policyVersion) && before.policyChecksum.equals(after.policyChecksum)
                    && before.maximumIterations == after.maximumIterations && before.revision < MAX_SAFE && after.revision == before.revision + 1
                    && !after.unenrolled && (action == PinLifecycleAction.enroll ? before.unenrolled : !before.unenrolled)
                    && (before.unenrolled ? after.pinRevision == 1 : before.pinRevision < MAX_SAFE && after.pinRevision == before.pinRevision + 1)
                    && (before.unenrolled || !before.credentialId.equals(after.credentialId) && !before.saltHex.equals(after.saltHex))
                    && after.count == 0 && after.blockedUntilMs == 0 && after.pendingAttemptId == null
                    && after.lastObservedMs == sampledLogicalMs && sampledLogicalMs >= before.logicalAnchorMs
                    && (before.unenrolled || sampledLogicalMs >= before.lastObservedMs)
                    && equalRange(oldBytes, before.revisionEnd, before.pinStart, nextBytes, after.revisionEnd, after.pinStart)
                    && equalRange(oldBytes, before.pinEnd, oldBytes.length, nextBytes, after.pinEnd, nextBytes.length));
            } finally { Arrays.fill(oldBytes, (byte) 0); if (nextBytes != null) Arrays.fill(nextBytes, (byte) 0); }
        }
        private static boolean equalRange(byte[] left, int from, int to, byte[] right, int otherFrom, int otherTo) {
            if (to - from != otherTo - otherFrom) return false;
            int different = 0; for (int i = 0; i < to - from; i++) different |= left[from + i] ^ right[otherFrom + i];
            return different == 0;
        }
        private static boolean identifier(String value) { return value != null && value.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"); }
        private static boolean hash(String value) { return value != null && value.matches("[a-f0-9]{64}"); }
        private static String registry(Cursor p, String version) throws Exception {
            p.field("schemaVersion", true); p.number(1, 1);
            p.field("policyVersion", false); require(p.string().equals(version));
            p.field("activeProfileId", false); String active = p.nullableString(); require(active == null || identifier(active));
            p.field("profiles", false); p.token("[");
            java.util.Set<String> ids = new java.util.HashSet<>(); int total = 0;
            if (!p.take("]")) {
                do { require(++total <= 4); require(ids.add(profile(p))); } while (p.take(","));
                p.token("]");
            }
            p.token("}"); require(active == null || ids.contains(active)); return active;
        }
        private static String profile(Cursor p) throws Exception {
            p.field("id", true); String id = p.string(); require(identifier(id));
            p.field("label", false); String label = p.string();
            require(label.length() >= 1 && label.length() <= 80 && !ecmaSpace(label.charAt(0)) && !ecmaSpace(label.charAt(label.length() - 1)));
            for (int i = 0; i < label.length(); i++) require(label.charAt(i) > 31 && label.charAt(i) != 127);
            p.field("exactAge", false); long age = p.number(3, 17);
            p.field("ageBand", false); require(p.string().equals(age <= 5 ? "3-5" : age <= 8 ? "6-8" : age <= 11 ? "9-11" : age <= 14 ? "12-14" : "15-17"));
            p.field("locale", false); String locale = p.string(); require(locale.equals("ru") || locale.equals("en"));
            p.field("ageConfirmedAt", false); date(p.string());
            p.field("readingLevel", false); String level = p.nullableString();
            require(level == null || level.equals("plain") || level.equals("developing") || level.equals("fluent"));
            p.field("allowedTopics", false); if (!p.take("null")) topics(p);
            p.field("blockedTopics", false); topics(p);
            p.field("soundEnabled", false); p.bool();
            p.field("motion", false); String motion = p.string(); require(motion.equals("calm") || motion.equals("system"));
            p.field("narrationEnabled", false); p.bool(); p.token("}"); return id;
        }
        private static boolean ecmaSpace(char value) {
            return value == 9 || value == 10 || value == 11 || value == 12 || value == 13 || value == 32 || value == 160
                || value == 0x1680 || value >= 0x2000 && value <= 0x200a || value == 0x2028 || value == 0x2029
                || value == 0x202f || value == 0x205f || value == 0x3000 || value == 0xfeff;
        }
        private static void date(String value) throws Exception {
            // TS decode uses strict four-digit UTC ISO plus Date round-trip.
            // A proleptic Gregorian check includes year0000, needs no java.time
            // or OS API, and rejects calendar rollover/24:00/leap seconds.
            require(value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));
            int year = Integer.parseInt(value.substring(0, 4)), month = Integer.parseInt(value.substring(5, 7)), day = Integer.parseInt(value.substring(8, 10));
            require(month >= 1 && month <= 12);
            int[] days = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
            if (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) days[1] = 29;
            require(day >= 1 && day <= days[month - 1] && Integer.parseInt(value.substring(11, 13)) <= 23
                && Integer.parseInt(value.substring(14, 16)) <= 59 && Integer.parseInt(value.substring(17, 19)) <= 59);
            // All canonical four-digit years precede decoder MAX_EPOCH.
        }
        private static void topics(Cursor p) throws Exception {
            p.token("["); java.util.Set<String> values = new java.util.HashSet<>(); int total = 0;
            if (!p.take("]")) {
                do { require(++total <= 64); String value = p.string();
                    require(value.matches("[a-z0-9][a-z0-9._-]{0,63}") && values.add(value)); } while (p.take(","));
                p.token("]");
            }
        }
        private static final class Pin {
            long revision, iterations, count, blockedUntilMs, lastObservedMs;
            String credentialId, saltHex, pendingAttemptId;
        }
        private static Pin pin(Cursor p, String version, long maximum) throws Exception {
            Pin pin = new Pin();
            p.field("schemaVersion", true); p.number(1, 1);
            p.field("policyVersion", false); require(p.string().equals(version));
            p.field("revision", false); pin.revision = p.number(1, MAX_SAFE);
            p.field("credentialId", false); pin.credentialId = p.string(); require(hash(pin.credentialId));
            p.field("verifier", false); p.field("algorithm", true); require(p.string().equals("PBKDF2-HMAC-SHA256"));
            p.field("iterations", false); pin.iterations = p.number(600000, maximum);
            p.field("saltHex", false); pin.saltHex = p.string(); require(hash(pin.saltHex));
            p.field("hashHex", false); require(hash(p.string())); p.token("}");
            p.field("attempts", false); p.field("count", true); pin.count = p.number(0, MAX_SAFE);
            p.field("blockedUntilMs", false); pin.blockedUntilMs = p.number(0, MAX_SAFE);
            p.field("lastObservedMs", false); pin.lastObservedMs = p.number(0, MAX_SAFE);
            p.field("pendingAttemptId", false); pin.pendingAttemptId = p.nullableString();
            require(pin.pendingAttemptId == null || hash(pin.pendingAttemptId)); p.token("}"); p.token("}");
            require(pin.count == 0 ? pin.blockedUntilMs == 0 && pin.pendingAttemptId == null : pin.blockedUntilMs >= pin.lastObservedMs);
            return pin;
        }
        private static long clock(Cursor p) throws Exception {
            p.field("schemaVersion", true); p.number(1, 1);
            p.field("bootId", false); require(validBoot(p.string()));
            p.field("uptimeAnchorMs", false); p.number(0, MAX_SAFE);
            p.field("logicalAnchorMs", false); long logical = p.number(0, MAX_SAFE);
            p.field("epochAnchor", false);
            if (!p.take("null")) {
                p.field("epochAnchorMs", true); long epoch = p.number(0, MAX_EPOCH);
                p.field("validUntilEpochMs", false); require(p.number(0, MAX_EPOCH) > epoch);
                p.field("proofChecksum", false); require(hash(p.string())); p.token("}");
            }
            p.token("}"); return logical;
        }
        /** Schema-bound lexer: no whitespace, floats/exponents, duplicate keys
         * or unknown nesting. Canonical strings follow ECMAScript JSON.stringify
         * escaping, including lower-hex escapes for lone UTF-16 surrogates.
         * Valid surrogate pairs are literal UTF-8, never escaped alternatives. */
        private static final class Cursor {
            final String text; int index;
            Cursor(String text) { this.text = text; }
            void field(String name, boolean first) throws Exception { token((first ? "{" : ",") + "\"" + name + "\":"); }
            void token(String expected) throws Exception { require(take(expected)); }
            boolean take(String expected) { if (!text.startsWith(expected, index)) return false; index += expected.length(); return true; }
            long number(long minimum, long maximum) throws Exception {
                require(index < text.length() && text.charAt(index) >= '0' && text.charAt(index) <= '9');
                long value = 0;
                if (text.charAt(index) == '0') index++;
                else {
                    while (index < text.length() && text.charAt(index) >= '0' && text.charAt(index) <= '9') {
                        int digit = text.charAt(index++) - '0'; require(value <= (MAX_SAFE - digit) / 10); value = value * 10 + digit;
                    }
                }
                require(value >= minimum && value <= maximum); return value;
            }
            boolean bool() throws Exception { if (take("true")) return true; token("false"); return false; }
            String nullableString() throws Exception { return take("null") ? null : string(); }
            String string() throws Exception {
                int start = index; token("\""); StringBuilder value = new StringBuilder(); boolean ended = false;
                while (index < text.length()) {
                    char next = text.charAt(index++);
                    if (next == '"') { ended = true; break; }
                    require(next >= 32);
                    if (next == '\\') {
                        require(index < text.length()); char escaped = text.charAt(index++);
                        if (escaped == '"' || escaped == '\\') next = escaped;
                        else if (escaped == 'b') next = 8; else if (escaped == 'f') next = 12;
                        else if (escaped == 'n') next = 10; else if (escaped == 'r') next = 13; else if (escaped == 't') next = 9;
                        else { require(escaped == 'u' && index + 4 <= text.length()); int code = 0;
                            for (int i = 0; i < 4; i++) { char digit = text.charAt(index++); int n = "0123456789abcdef".indexOf(digit); require(n >= 0); code = code * 16 + n; }
                            next = (char) code;
                        }
                    }
                    value.append(next);
                }
                require(ended); String decoded = value.toString(), canonical = quote(decoded);
                require(index - start == canonical.length() && text.regionMatches(start, canonical, 0, canonical.length()));
                return decoded;
            }
            int byteOffset(int position) {
                byte[] bytes = text.substring(0, position).getBytes(StandardCharsets.UTF_8);
                try { return bytes.length; } finally { Arrays.fill(bytes, (byte) 0); }
            }
            private static void escaped(StringBuilder out, char value) {
                final String hex = "0123456789abcdef"; out.append("\\u");
                out.append(hex.charAt(value >>> 12 & 15)).append(hex.charAt(value >>> 8 & 15))
                    .append(hex.charAt(value >>> 4 & 15)).append(hex.charAt(value & 15));
            }
            private static String quote(String value) {
                StringBuilder out = new StringBuilder().append('"');
                for (int i = 0; i < value.length(); i++) {
                    char c = value.charAt(i);
                    if (c == '"') out.append("\\\""); else if (c == '\\') out.append("\\\\");
                    else if (c == 8) out.append("\\b"); else if (c == 9) out.append("\\t");
                    else if (c == 10) out.append("\\n"); else if (c == 12) out.append("\\f"); else if (c == 13) out.append("\\r");
                    else if (c < 32) escaped(out, c);
                    else if (Character.isHighSurrogate(c)) {
                        if (i + 1 < value.length() && Character.isLowSurrogate(value.charAt(i + 1))) out.append(c).append(value.charAt(++i));
                        else escaped(out, c);
                    } else if (Character.isLowSurrogate(c)) escaped(out, c); else out.append(c);
                }
                return out.append('"').toString();
            }
        }
    }

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

