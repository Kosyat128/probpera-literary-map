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

    /** Private mechanical foundation only, not an admitted enrollment provider.
     * No bridge, native input/KDF/calibration, seed provisioning, genuine epoch,
     * host/action/reset/recovery authority or wire-delivery implementation is
     * supplied here. The sole factory below remains unavailable. */
    private static final class PinSessionPolicy {
        final String version, checksum; final long maximumIterations, iterations;
        private PinSessionPolicy(String version, String checksum, long maximum, long iterations) throws Exception {
            require(ProtectedEnvelope.identifier(version) && ProtectedEnvelope.hash(checksum)
                && maximum >= 600000 && maximum <= 0xffffffffL && iterations >= 600000 && iterations <= maximum);
            this.version=version; this.checksum=checksum; maximumIterations=maximum; this.iterations=iterations;
        }
    }
    private enum PinSessionPhase { reserved, beginning, begun, committing, committed, denied, cancelled, sealed, closing, closed }
    private enum PinReplyDelivery { known, uncertain }
    private static final class PinKnownRefusal extends Exception { private PinKnownRefusal() {} }
    private interface PinSessionTask<T> { T run(PinSessionTransaction transaction) throws Exception; }
    private interface PinBytesTask<T> { T run(byte[] disposable) throws Exception; }
    private interface PinSessionTransaction {
        byte[] read() throws Exception;
        void write(byte[] next, CommitCheck boundary) throws Exception;
    }
    private interface PinSessionIO { <T> T locked(PinSessionTask<T> task) throws Exception; }
    /** Only the future admitted private host can implement these dependencies.
     * Metadata/void callbacks or a test implementation establish no authority.
     * capture/current authenticate exact bytes+checkpoint epoch/revision, real
     * host/account/profile/lifecycle and supported boot/continuous logical time.
     * authorizeMutation authenticates actual native PIN input/KDF/calibration
     * and one-use permission for this exact replacement AND attempt reset.
     * advance consumes that permission durably before checkpoint publication;
     * failure/divergence never authorizes record-only repair. */
    private interface PinSessionAuthority {
        PinNativeCoordinates capture(OwnedPinInspection inspection, byte[] bytes, String checksum, long revision) throws Exception;
        PinNativeCoordinates current(OwnedPinSession session, byte[] bytes, String checksum, long revision) throws Exception;
        Object authorizeMutation(OwnedPinSession session, byte[] next, String checksum, long revision) throws Exception;
        void advance(OwnedPinSession session, Object resetPermission, Object recoveryPermission, String checksum, long revision) throws Exception;
        void cancel(OwnedPinInspection inspection) throws Exception;
        // Terminal whole-request retirement joins/revokes every permission;
        // after the core's no-new-work fence it also covers any later cancel.
        void retire(OwnedPinInspection inspection) throws Exception;
    }
    /** Distinct genuine recovery, bound to the same complete coordinates. */
    private interface PinRecoveryAuthority { void verify(OwnedPinSession session, byte[] next, String checksum, long revision, Object permission) throws Exception; }
    private static final class PinNativeCoordinates {
        final PinSessionAuthority owner;
        final String epoch, bootId, checksum; final long revision, hostGeneration, uptimeMs, logicalMs;
        private PinNativeCoordinates(PinSessionAuthority owner, String epoch, String bootId, String checksum,
            long revision, long hostGeneration, long uptimeMs, long logicalMs) {
            this.owner=owner; this.epoch=epoch; this.bootId=bootId; this.checksum=checksum; this.revision=revision;
            this.hostGeneration=hostGeneration; this.uptimeMs=uptimeMs; this.logicalMs=logicalMs;
        }
    }
    private static final class OwnedPinInspection {
        final NativePinSessions owner; final String wireId; final PinLifecycleAction action; final long timeoutMs;
        PinSessionPhase phase=PinSessionPhase.reserved; boolean cancelled, sealed, retiring, retirementFenced;
        int workers, transfers; OwnedPinSession session; PinNativeReply terminalReply;
        final java.util.IdentityHashMap<Thread,Integer> threads=new java.util.IdentityHashMap<>();
        final java.util.Set<PinNativeReply> pendingReplies=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<PinNativeReply,Boolean>());
        private OwnedPinInspection(NativePinSessions owner,String id,PinLifecycleAction action,long timeout) {
            this.owner=owner; wireId=id; this.action=action; timeoutMs=timeout;
        }
    }
    private static final class OwnedPinSession {
        final NativePinSessions owner; final OwnedPinInspection inspection; final PinSessionPolicy policy;
        final String checksum, epoch, bootId; final long revision, hostGeneration, capturedUptimeMs, capturedLogicalMs, deadlineUptimeMs;
        final long clockUptimeMs, clockLogicalMs; private final byte[] expected; private boolean disposed;
        private OwnedPinSession(NativePinSessions owner,OwnedPinInspection inspection,byte[] bytes,ProtectedEnvelope envelope,
            PinNativeCoordinates point,long clockUptime,long deadline) {
            this.owner=owner; this.inspection=inspection; policy=owner.policy; expected=bytes.clone(); checksum=envelope.checksum;
            revision=envelope.revision; epoch=point.epoch; bootId=point.bootId; hostGeneration=point.hostGeneration;
            capturedUptimeMs=point.uptimeMs; capturedLogicalMs=point.logicalMs; deadlineUptimeMs=deadline;
            clockUptimeMs=clockUptime; clockLogicalMs=envelope.logicalAnchorMs;
        }
        private void close() { disposed=true; Arrays.fill(expected,(byte)0); }
    }
    /** Local one-use ownership wrapper. Its opaque dependency witness still
     * requires genuine native authentication; this constructor grants none. */
    private static final class OwnedPinMutation {
        private final NativePinSessions owner; private final OwnedPinSession session;
        private final Object reset, recovery; private final String checksum;
        private final long revision, capturedResetLogicalMs; private boolean consumed;
        private OwnedPinMutation(NativePinSessions owner,OwnedPinSession session,Object reset,Object recovery,String checksum,long revision) {
            this.owner=owner;this.session=session;this.reset=reset;this.recovery=recovery;this.checksum=checksum;this.revision=revision;
            capturedResetLogicalMs=session.capturedLogicalMs;
        }
    }
    /** Owned reply transfer. close wipes bytes but does not prove transport
     * settlement/delivery and cannot release the session's exclusive lane. */
    private static final class PinNativeReply implements AutoCloseable {
        final NativePinSessions owner; final OwnedPinInspection inspection; final OwnedPinSession session;
        final String checksum; final boolean terminal; private final byte[] bytes; private boolean disposed, settled;
        private PinNativeReply(NativePinSessions owner,OwnedPinSession session,byte[] bytes,String checksum) {
            this(owner,session.inspection,session,bytes,checksum,false);
        }
        private PinNativeReply(NativePinSessions owner,OwnedPinInspection inspection,OwnedPinSession session,byte[] bytes,String checksum,boolean terminal) {
            this.owner=owner; this.inspection=inspection; this.session=session; this.bytes=bytes.clone(); this.checksum=checksum; this.terminal=terminal;
        }
        private synchronized byte[] copyBytes() throws Exception { require(!disposed); return bytes.clone(); }
        public synchronized void close() { disposed=true; Arrays.fill(bytes,(byte)0); }
    }
    private static final class NativePinSessions {
        private final PinSessionIO io; private final PinSessionAuthority authority;
        private final PinRecoveryAuthority recovery; private final PinSessionPolicy policy;
        private final java.util.Set<String> usedWireIds=new java.util.HashSet<>();
        private OwnedPinInspection active;
        private NativePinSessions(PinSessionIO io,PinSessionAuthority authority,PinRecoveryAuthority recovery,PinSessionPolicy policy) throws Exception {
            require(io!=null && authority!=null && policy!=null); this.io=io; this.authority=authority; this.recovery=recovery; this.policy=policy;
        }
        /** Native trusted-host provenance seam only; not a JSON/UI constructor.
         * IDs are never evicted, even after denied busy registrations. */
        private synchronized OwnedPinInspection inspection(String wireId,PinLifecycleAction action,long timeout) throws Exception {
            require(ProtectedEnvelope.hash(wireId) && action!=null && timeout>=1 && timeout<=60000
                && usedWireIds.size()<2048 && usedWireIds.add(wireId));
            require(active==null); active=new OwnedPinInspection(this,wireId,action,timeout); return active;
        }
        private void own(OwnedPinInspection inspection) throws Exception { require(inspection!=null && inspection.owner==this && active==inspection && inspection.phase!=PinSessionPhase.closed); }
        private void live(OwnedPinInspection inspection) throws Exception { synchronized(this) { own(inspection); if(inspection.cancelled || inspection.sealed)throw new PinKnownRefusal(); } }
        private void worker(OwnedPinInspection inspection) {
            inspection.workers++; Thread thread=Thread.currentThread(); inspection.threads.put(thread,inspection.threads.getOrDefault(thread,0)+1);
        }
        private synchronized void settleWorker(OwnedPinInspection inspection) {
            inspection.workers--; Thread thread=Thread.currentThread(); int remaining=inspection.threads.get(thread)-1;
            if(remaining==0)inspection.threads.remove(thread);else inspection.threads.put(thread,remaining);wipeSealedLocked(inspection);notifyAll();
        }
        private synchronized void claim(OwnedPinInspection inspection,PinSessionPhase expected,PinSessionPhase next) throws Exception {
            live(inspection); require(!inspection.retiring && inspection.phase==expected); inspection.phase=next; worker(inspection);
        }
        private synchronized void failed(OwnedPinInspection inspection,Exception error,boolean publicationEntered) {
            if(inspection.sealed || publicationEntered || !(error instanceof PinKnownRefusal)) { inspection.sealed=true; inspection.phase=PinSessionPhase.sealed; }
            else inspection.phase=inspection.cancelled?PinSessionPhase.cancelled:PinSessionPhase.denied;
            wipeSealedLocked(inspection);
        }
        /** Secrecy cleanup is independent of delivery/authority settlement.
         * Never decrement a transfer, remove its identity or release capacity.
         * Expected bytes remain available to actual workers until they return. */
        private void wipeSealedLocked(OwnedPinInspection inspection) {
            if(!inspection.sealed)return;
            for(PinNativeReply reply:inspection.pendingReplies)reply.close();
            if(inspection.workers==0 && inspection.session!=null)inspection.session.close();
        }
        private static long safeAdd(long left,long right) throws Exception { require(left>=0 && right>=0 && left<=MAX_SAFE-right); return left+right; }
        /** Mutable dependency buffers are disposable copies, never the bytes
         * whose canonical transition/digest has been checked. Mutation denies;
         * wiping occurs after the callback actually returns or throws. */
        private static <T>T isolated(byte[] owned,PinBytesTask<T> task) throws Exception {
            byte[] disposable=owned.clone();
            try{T result=task.run(disposable);require(MessageDigest.isEqual(disposable,owned));return result;}
            finally{Arrays.fill(disposable,(byte)0);}
        }
        private void sessionFence(OwnedPinSession session) throws Exception {
            live(session.inspection);require(session.owner==this && session.policy==policy && session.inspection.session==session
                && !session.disposed && digest(session.expected).equals(session.checksum));
        }
        private void mutationFence(OwnedPinSession session,byte[] before,byte[] after,String nextChecksum,long nextRevision) throws Exception {
            sessionFence(session);require(MessageDigest.isEqual(before,session.expected) && digest(before).equals(session.checksum)
                && digest(after).equals(nextChecksum) && session.revision<MAX_SAFE && nextRevision==session.revision+1);
        }
        private void advanceMutation(OwnedPinMutation mutation) throws Exception {
            sessionFence(mutation.session);require(mutation.owner==this && !mutation.consumed && mutation.reset!=null
                && mutation.capturedResetLogicalMs==mutation.session.capturedLogicalMs
                && mutation.revision==mutation.session.revision+1 && ProtectedEnvelope.hash(mutation.checksum));
            mutation.consumed=true;authority.advance(mutation.session,mutation.reset,mutation.recovery,mutation.checksum,mutation.revision);
        }
        private static long[] clockCoordinates(ProtectedEnvelope envelope) throws Exception {
            // The full envelope was already decoded canonically. Clock suffix
            // is ASCII-only; reuse the closed lexer, without changing codec.
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(envelope.canonical,envelope.pinEnd,envelope.canonical.length-envelope.pinEnd,StandardCharsets.US_ASCII));
            p.field("clock",false);p.field("schemaVersion",true);p.number(1,1);p.field("bootId",false);String boot=p.string();
            p.field("uptimeAnchorMs",false);long uptime=p.number(0,MAX_SAFE);
            return new long[]{uptime,validBoot(boot)?1:0};
        }
        private static String clockBoot(ProtectedEnvelope envelope) throws Exception {
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(envelope.canonical,envelope.pinEnd,envelope.canonical.length-envelope.pinEnd,StandardCharsets.US_ASCII));
            p.field("clock",false);p.field("schemaVersion",true);p.number(1,1);p.field("bootId",false);return p.string();
        }
        private void coordinates(PinNativeCoordinates point,String checksum,long revision) throws Exception {
            require(point!=null && point.owner==authority && ProtectedEnvelope.hash(point.epoch) && validBoot(point.bootId)
                && point.checksum.equals(checksum) && point.revision==revision && point.hostGeneration>=0 && point.hostGeneration<=MAX_SAFE
                && point.uptimeMs>=0 && point.uptimeMs<=MAX_SAFE && point.logicalMs>=0 && point.logicalMs<=MAX_SAFE);
        }
        private PinNativeCoordinates current(OwnedPinSession session,byte[] bytes,String checksum,long revision) throws Exception {
            sessionFence(session);require(digest(bytes).equals(checksum));
            PinNativeCoordinates point=isolated(bytes,copy->authority.current(session,copy,checksum,revision));
            sessionFence(session);require(digest(bytes).equals(checksum));coordinates(point,checksum,revision);
            require(point.epoch.equals(session.epoch) && point.hostGeneration==session.hostGeneration && point.bootId.equals(session.bootId)
                && point.uptimeMs>=session.capturedUptimeMs && point.uptimeMs<session.deadlineUptimeMs
                && point.logicalMs==safeAdd(session.clockLogicalMs,point.uptimeMs-session.clockUptimeMs));
            live(session.inspection); return point;
        }
        private synchronized PinNativeReply reply(OwnedPinSession session,byte[] bytes,String checksum,PinSessionPhase phase) throws Exception {
            live(session.inspection);PinNativeReply result=new PinNativeReply(this,session,bytes,checksum);
            session.inspection.pendingReplies.add(result);session.inspection.transfers++;session.inspection.phase=phase;return result;
        }
        private PinNativeReply begin(OwnedPinInspection inspection) throws Exception {
            claim(inspection,PinSessionPhase.reserved,PinSessionPhase.beginning);
            try { return io.locked(transaction->{
                live(inspection); byte[] bytes=transaction.read();
                try(ProtectedEnvelope before=ProtectedEnvelope.decode(bytes,policy.version,policy.checksum,policy.maximumIterations)) {
                    if((inspection.action==PinLifecycleAction.enroll)!=before.unenrolled
                        || inspection.action==PinLifecycleAction.recover && recovery==null)throw new PinKnownRefusal();
                    PinNativeCoordinates point=isolated(bytes,copy->authority.capture(inspection,copy,before.checksum,before.revision));
                    live(inspection);require(digest(bytes).equals(before.checksum));coordinates(point,before.checksum,before.revision);
                    long[] clock=clockCoordinates(before); require(clock[1]==1 && point.bootId.equals(clockBoot(before)) && point.uptimeMs>=clock[0]
                        && point.logicalMs==safeAdd(before.logicalAnchorMs,point.uptimeMs-clock[0]) && (before.unenrolled || point.logicalMs>=before.lastObservedMs));
                    long deadline=safeAdd(point.uptimeMs,inspection.timeoutMs);live(inspection);
                    OwnedPinSession session;
                    synchronized(this){live(inspection);session=new OwnedPinSession(this,inspection,bytes,before,point,clock[0],deadline);inspection.session=session;}
                    current(session,bytes,before.checksum,before.revision);
                    return reply(session,bytes,before.checksum,PinSessionPhase.begun);
                } finally { if(bytes!=null)Arrays.fill(bytes,(byte)0); }
            }); } catch(Exception error){failed(inspection,error,false);throw error;} finally{settleWorker(inspection);}
        }
        /** Exact native-owned DTO coordinates; a caller's bytes/action are not
         * permission. Only private future host code can reach this method. */
        private PinNativeReply commit(OwnedPinInspection inspection,OwnedPinSession session,byte[] expected,byte[] next,
            String expectedChecksum,String nextChecksum,long expectedRevision,long nextRevision,String nativeEpoch,long hostGeneration,
            String bootId,long deadlineUptimeMs,Object recoveryPermission) throws Exception {
            claim(inspection,PinSessionPhase.begun,PinSessionPhase.committing);
            byte[] old=null,fresh=null;final boolean[] publicationEntered={false};
            try {
                require(session!=null && session.owner==this && session.inspection==inspection && inspection.session==session && !session.disposed
                    && expected!=null && next!=null && expected.length>0 && expected.length<=MAX_BYTES && next.length>0 && next.length<=MAX_BYTES);
                old=expected.clone();fresh=next.clone(); final byte[] ownedOld=old,ownedNext=fresh;
                require(expectedChecksum.equals(session.checksum) && digest(old).equals(expectedChecksum) && digest(fresh).equals(nextChecksum)
                    && expectedRevision==session.revision && expectedRevision<MAX_SAFE && nextRevision==expectedRevision+1
                    && nativeEpoch.equals(session.epoch) && hostGeneration==session.hostGeneration && bootId.equals(session.bootId)
                    && deadlineUptimeMs==session.deadlineUptimeMs && MessageDigest.isEqual(old,session.expected));
                return io.locked(transaction->{
                    live(inspection);byte[] actual=transaction.read();
                    try(ProtectedEnvelope before=ProtectedEnvelope.decode(ownedOld,policy.version,policy.checksum,policy.maximumIterations);
                        ProtectedEnvelope after=ProtectedEnvelope.decode(ownedNext,policy.version,policy.checksum,policy.maximumIterations)) {
                        require(MessageDigest.isEqual(actual,ownedOld));current(session,ownedOld,expectedChecksum,expectedRevision);
                        // TS's reset timestamp is the authenticated begin
                        // snapshot, while current/deadline checks use actual
                        // later continuous time throughout native publication.
                        ProtectedEnvelope.validateTransition(before,after,inspection.action,session.capturedLogicalMs);require(after.iterations==policy.iterations);
                        if(inspection.action==PinLifecycleAction.recover) {
                            if(recovery==null || recoveryPermission==null)throw new PinKnownRefusal();
                            isolated(ownedNext,copy->{recovery.verify(session,copy,nextChecksum,nextRevision,recoveryPermission);return null;});
                            mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);
                        } else if(recoveryPermission!=null)throw new PinKnownRefusal();
                        Object resetPermission=isolated(ownedNext,copy->authority.authorizeMutation(session,copy,nextChecksum,nextRevision));require(resetPermission!=null);
                        mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);
                        current(session,ownedOld,expectedChecksum,expectedRevision);
                        mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);
                        OwnedPinMutation mutation=new OwnedPinMutation(this,session,resetPermission,recoveryPermission,nextChecksum,nextRevision);
                        publicationEntered[0]=true;advanceMutation(mutation);
                        mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);
                        byte[] publication=ownedNext.clone();
                        try {
                            CommitCheck boundary=()->{mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);
                                require(MessageDigest.isEqual(publication,ownedNext) && digest(publication).equals(nextChecksum));
                                current(session,ownedNext,nextChecksum,nextRevision);
                                mutationFence(session,ownedOld,ownedNext,nextChecksum,nextRevision);};
                            boundary.check();transaction.write(publication,boundary);boundary.check();
                            byte[] readback=transaction.read();try{require(MessageDigest.isEqual(readback,ownedNext));}finally{if(readback!=null)Arrays.fill(readback,(byte)0);}
                            boundary.check();return reply(session,ownedNext,nextChecksum,PinSessionPhase.committed);
                        } finally{Arrays.fill(publication,(byte)0);}
                    } finally{if(actual!=null)Arrays.fill(actual,(byte)0);}
                });
            } catch(Exception error){failed(inspection,error,publicationEntered[0]);throw error;}
            finally{if(old!=null)Arrays.fill(old,(byte)0);if(fresh!=null)Arrays.fill(fresh,(byte)0);settleWorker(inspection);}
        }
        private void cancel(OwnedPinInspection inspection) throws Exception {
            synchronized(this){own(inspection);if(inspection.cancelled)return;inspection.cancelled=true;
                // Once all workers/transfers are joined, no new operation can
                // start. Terminal whole-request authority retirement covers
                // this late revocation, so it creates no unjoined cancel work.
                if(inspection.retirementFenced)return;worker(inspection);}
            try{io.locked(transaction->{authority.cancel(inspection);return null;});}
            catch(Exception error){failed(inspection,error,false);throw error;}finally{settleWorker(inspection);}
        }
        /** Only the genuine private host's real transfer-settlement event can
         * call this seam. A close/timeout is not such an event; wire ACK and
         * publication ordering still require that unimplemented host adapter. */
        private synchronized void settleReply(PinNativeReply reply,PinReplyDelivery delivery) throws Exception {
            require(reply!=null && reply.owner==this && delivery!=null);own(reply.inspection);
            require(!reply.settled && reply.session==reply.inspection.session && reply.inspection.pendingReplies.contains(reply));
            if(reply.terminal)require(reply.inspection.terminalReply==reply && reply.inspection.retirementFenced
                && reply.inspection.workers==0 && reply.inspection.transfers==1);
            reply.settled=true;reply.close();reply.inspection.pendingReplies.remove(reply);reply.inspection.transfers--;
            if(delivery==PinReplyDelivery.uncertain || !reply.terminal && reply.inspection.cancelled){reply.inspection.sealed=true;reply.inspection.phase=PinSessionPhase.sealed;}
            wipeSealedLocked(reply.inspection);
            if(reply.terminal && !reply.inspection.sealed){reply.inspection.phase=PinSessionPhase.closed;active=null;}
            notifyAll();
        }
        private synchronized void sealUnknown(OwnedPinInspection inspection) throws Exception { own(inspection);inspection.sealed=true;inspection.phase=PinSessionPhase.sealed;wipeSealedLocked(inspection);notifyAll(); }
        private PinNativeReply retire(OwnedPinInspection inspection) throws Exception {
            synchronized(this){own(inspection);require(!inspection.retiring && !inspection.threads.containsKey(Thread.currentThread()));inspection.retiring=true;
                try{while(inspection.workers!=0 || inspection.transfers!=0)wait();inspection.retirementFenced=true;}
                catch(InterruptedException interrupted){inspection.sealed=true;inspection.phase=PinSessionPhase.sealed;wipeSealedLocked(inspection);Thread.currentThread().interrupt();throw new Unavailable();}
            }
            try{io.locked(transaction->{authority.retire(inspection);return null;});}
            catch(Exception error){synchronized(this){inspection.sealed=true;inspection.phase=PinSessionPhase.sealed;wipeSealedLocked(inspection);}throw error;}
            synchronized(this){require(inspection.workers==0 && inspection.transfers==0);if(inspection.session!=null)inspection.session.close();
                PinNativeReply terminal=new PinNativeReply(this,inspection,inspection.session,new byte[0],null,true);
                inspection.terminalReply=terminal;inspection.pendingReplies.add(terminal);inspection.transfers++;if(!inspection.sealed)inspection.phase=PinSessionPhase.closing;
                notifyAll();return terminal;}
        }
    }
    /** The production factory deliberately supplies no provider. A future
     * implementation must authenticate genuine owner/checkpoint/host/action,
     * supported time, input, calibration and recovery; ordinary Keystore does
     * not satisfy these dependencies. No injection constructor is exported. */
    private static NativePinSessions actualSdkPinSessions(PlanetChildVault vault) { return null; }
    /** Fixed future private adapter. The same existing cross-process vault
     * lock owns every read/publication/cancel/permission-retirement callback. */
    private PinSessionIO ownedPinSessionIO() {
        return new PinSessionIO(){public <T>T locked(PinSessionTask<T> task)throws Exception{
            final PinKnownRefusal[] refused={null};
            T result=PlanetChildVault.this.locked(directory->{try{return task.run(new PinSessionTransaction(){
                    public byte[] read()throws Exception{return readExact(directory);}
                    public void write(byte[] next,CommitCheck boundary)throws Exception{writeExact(directory,next,boundary);}
                });}catch(PinKnownRefusal known){refused[0]=known;return null;}});
            if(refused[0]!=null)throw refused[0];return result;
        }};
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

