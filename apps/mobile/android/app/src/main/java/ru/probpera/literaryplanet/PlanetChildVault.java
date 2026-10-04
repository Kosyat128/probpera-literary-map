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
            p.field("narrationEnabled", false); p.bool(); if (p.take(",\"localeLocked\":")) p.bool(); p.token("}"); return id;
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
        private PinPrimitiveContext primitiveContext;
        private OwnedPinOwnerRequest ownerAuthorization;
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
    /** Local OS-owner authorization only. No cloud bytes, Parent Gate proof,
     * checkpoint, trusted cross-boot clock, or factory admission is supplied.
     * API30+ device credential unlocks the ORIGINAL auth-per-use Signature;
     * a callback flag cannot substitute for its actual verified signature. */
    private interface PinOwnerRecipient { void completed(PinOwnerPermission permission) throws Exception; }
    private static final class OwnedPinOwnerRequest implements AutoCloseable {
        final PinNativeOwnerAuthority owner; final OwnedPinSession session;
        final android.app.Activity activity; final android.os.IBinder windowToken;
        final String locale,nextChecksum; final long nextRevision;
        private final byte[] next,nonce,payload;
        private Thread worker,watcher; private boolean started,revoked,finished,disposed,cleanupFenced,stopWatch,retired,detached;
        private boolean promptOutstanding,credentialReturned,deliveryCompleted,deliveryEntered,sealed,cancelIssued;
        private int mainCalls,cancelCalls,consumeCalls,eventCalls,cleanupCalls; private Exception promptError,mainError;
        private android.os.CancellationSignal cancellation;
        private android.hardware.biometrics.BiometricPrompt.CryptoObject originalCrypto;
        private java.security.Signature originalSignature; private java.security.PublicKey publicKey;
        private byte[] keyEncoding; private PinOwnerPermission permission;
        private OwnedPinOwnerRequest(PinNativeOwnerAuthority owner,OwnedPinSession session,byte[] next,
            String checksum,long revision,android.app.Activity activity,String locale,android.os.IBinder token) throws Exception {
            this.owner=owner;this.session=session;this.next=next.clone();nextChecksum=checksum;nextRevision=revision;
            this.activity=activity;this.locale=locale;windowToken=token;nonce=new byte[32];
            new java.security.SecureRandom().nextBytes(nonce);payload=PinNativeOwnerAuthority.operation(this);
        }
        public void close() { synchronized(owner.core){revoked=true;disposed=true;if(finished && consumeCalls==0)wipe();}owner.cancel(this); }
        private void wipe(){Arrays.fill(next,(byte)0);Arrays.fill(nonce,(byte)0);Arrays.fill(payload,(byte)0);
            if(keyEncoding!=null)Arrays.fill(keyEncoding,(byte)0);if(permission!=null)permission.wipe();}
    }
    /** The local signature authenticates device-credential use for this exact
     * original request. It is never a durable checkpoint or legal guardian proof.
     * close revokes/wipes; only original host settlement drains the reply. */
    private static final class PinOwnerPermission implements AutoCloseable {
        final PinNativeOwnerAuthority owner; final OwnedPinOwnerRequest request; final PinNativeReply backing;
        private final byte[] signature; private boolean consumed,disposed,settled,knownDelivery;
        private PinOwnerPermission(PinNativeOwnerAuthority owner,OwnedPinOwnerRequest request,byte[] signature,PinNativeReply backing) {
            this.owner=owner;this.request=request;this.signature=signature.clone();this.backing=backing;
        }
        private void wipe(){disposed=true;Arrays.fill(signature,(byte)0);}
        public void close(){synchronized(owner.core){request.revoked=true;disposed=true;if(request.consumeCalls==0)wipe();}owner.cancel(request);}
    }
    private static final class PinNativeOwnerAuthority {
        private final NativePinSessions core; private OwnedPinOwnerRequest original;
        private PinNativeOwnerAuthority(NativePinSessions core) throws Exception {require(core!=null);this.core=core;}
        /** Only a native-owned enrolled session can request recovery. Initial
         * enrollment alone may create the fixed private key; never replace it. */
        private OwnedPinOwnerRequest request(OwnedPinSession session,byte[] next,String checksum,long revision,
            android.app.Activity activity,String locale) throws Exception {
            require(android.os.Build.VERSION.SDK_INT>=30 && android.os.Looper.myLooper()==android.os.Looper.getMainLooper()
                && activity!=null && activity.getClass()==MainActivity.class && !activity.isFinishing() && !activity.isDestroyed()
                && activity.hasWindowFocus() && ("ru".equals(locale)||"en".equals(locale))
                && next!=null && next.length>0 && next.length<=MAX_BYTES && ProtectedEnvelope.hash(checksum));
            android.os.IBinder token=activity.getWindow().getDecorView().getWindowToken();require(token!=null);
            synchronized(core){require(original==null && session!=null && session.owner==core
                && session.inspection.session==session && !session.disposed
                && (session.inspection.action==PinLifecycleAction.enroll || session.inspection.action==PinLifecycleAction.recover));
                core.sessionFence(session);require(session.inspection.ownerAuthorization==null && !session.inspection.retiring && session.inspection.workers==0
                    && nativeInputRetirementReady(session.inspection) && session.inspection.phase==PinSessionPhase.begun);
                byte[] owned=next.clone();try{core.mutationFence(session,session.expected,owned,checksum,revision);
                    try(ProtectedEnvelope before=ProtectedEnvelope.decode(session.expected,core.policy.version,core.policy.checksum,core.policy.maximumIterations);
                        ProtectedEnvelope after=ProtectedEnvelope.decode(owned,core.policy.version,core.policy.checksum,core.policy.maximumIterations)) {
                        ProtectedEnvelope.validateTransition(before,after,session.inspection.action,session.capturedLogicalMs);
                        require(after.iterations==core.policy.iterations);
                    }
                    original=new OwnedPinOwnerRequest(this,session,owned,checksum,revision,activity,locale,token);
                    session.inspection.ownerAuthorization=original;return original;
                }finally{Arrays.fill(owned,(byte)0);}}
        }
        /** Binary, local-only domain separation; no profile labels/ages/topics
         * leave the vault. Native host object identity remains an original-object
         * comparison, not a serialized number or a signed assertion from JS. */
        private static byte[] operation(OwnedPinOwnerRequest request) throws Exception {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream(512);
            java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);OwnedPinSession s=request.session;
            out.write("LP-LOCAL-DEVICE-OWNER-PERMISSION\0v1\0".getBytes(StandardCharsets.US_ASCII));
            out.writeByte(s.inspection.action==PinLifecycleAction.enroll?1:2);
            out.writeByte("ru".equals(request.locale)?1:2);
            byte[] scope=(alias(request.activity)+"\0"+s.policy.version).getBytes(StandardCharsets.US_ASCII);
            try{out.writeShort(scope.length);out.write(scope);}finally{Arrays.fill(scope,(byte)0);}
            for(String value:new String[]{s.inspection.wireId,s.checksum,request.nextChecksum,s.epoch,s.bootId,s.policy.checksum})out.write(value.getBytes(StandardCharsets.US_ASCII));
            for(long value:new long[]{s.revision,request.nextRevision,s.hostGeneration,s.capturedUptimeMs,s.capturedLogicalMs,s.deadlineUptimeMs})out.writeLong(value);
            out.write(request.nonce);out.flush();return bytes.toByteArray();
        }
        private void own(OwnedPinOwnerRequest request) throws Exception {require(request!=null && request.owner==this && original==request);}
        private void live(OwnedPinOwnerRequest request) throws Exception {
            synchronized(core){own(request);require(request.session.inspection.ownerAuthorization==request);core.sessionFence(request.session);
                if(request.revoked || request.disposed || request.sealed || request.session.inspection.retiring
                    || SystemClock.elapsedRealtime()>=request.session.deadlineUptimeMs)throw new PinKnownRefusal();
                core.mutationFence(request.session,request.session.expected,request.next,request.nextChecksum,request.nextRevision);
                byte[] payload=operation(request);try{require(MessageDigest.isEqual(payload,request.payload));}finally{Arrays.fill(payload,(byte)0);}}
        }
        /** Actual durable read/current/whole-byte fence on a background worker;
         * existing authority authenticates boot/epoch/host, never this key alone. */
        private void current(OwnedPinOwnerRequest request) throws Exception {
            host(request);live(request);core.io.locked(transaction->{byte[] actual=transaction.read();try{
                live(request);require(MessageDigest.isEqual(actual,request.session.expected));
                core.current(request.session,actual,request.session.checksum,request.session.revision);live(request);return null;
            }finally{Arrays.fill(actual,(byte)0);}});host(request);live(request);
        }
        private static String alias(android.app.Activity activity) throws Exception {
            String name=activity.getPackageName();require(name.matches("ru\\.probpera\\.literaryplanet(?:\\.dev|\\.rustore)?"));
            return name+".literary-planet-child-device-owner-sign-v1";
        }
        private void key(OwnedPinOwnerRequest request) throws Exception {
            core.io.locked(transaction->{byte[] actual=transaction.read();try{
                live(request);require(MessageDigest.isEqual(actual,request.session.expected));
                core.current(request.session,actual,request.session.checksum,request.session.revision);keyLocked(request);
                core.current(request.session,actual,request.session.checksum,request.session.revision);live(request);return null;
            }finally{Arrays.fill(actual,(byte)0);}});
        }
        private void keyLocked(OwnedPinOwnerRequest request) throws Exception {
            live(request);KeyguardManager guard=(KeyguardManager)request.activity.getSystemService(Context.KEYGUARD_SERVICE);
            require(guard!=null && guard.isDeviceSecure());String alias=alias(request.activity);
            KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
            if(!store.containsAlias(alias)) {
                if(request.session.inspection.action!=PinLifecycleAction.enroll)throw new PinKnownRefusal();
                live(request);java.security.KeyPairGenerator generator=java.security.KeyPairGenerator.getInstance("EC","AndroidKeyStore");
                generator.initialize(new android.security.keystore.KeyGenParameterSpec.Builder(alias,android.security.keystore.KeyProperties.PURPOSE_SIGN)
                    .setAlgorithmParameterSpec(new java.security.spec.ECGenParameterSpec("secp256r1"))
                    .setDigests(android.security.keystore.KeyProperties.DIGEST_SHA256).setUserAuthenticationRequired(true)
                    .setUserAuthenticationParameters(0,android.security.keystore.KeyProperties.AUTH_DEVICE_CREDENTIAL).build());
                generator.generateKeyPair();
            }
            // Existing invalidated/missing/wrong keys deny. No deleteEntry or
            // catch-and-regenerate path exists, including owner recovery.
            live(request);PinOwnerSigningMaterial material=signingMaterial(store,alias);
            boolean adopted=false;try{android.os.CancellationSignal cancellation=new android.os.CancellationSignal();
                synchronized(core){live(request);request.publicKey=material.publicKey;request.keyEncoding=material.encoding;
                    request.originalSignature=material.signature;request.originalCrypto=material.crypto;request.cancellation=cancellation;adopted=true;}
            }finally{if(!adopted)Arrays.fill(material.encoding,(byte)0);}
        }
        /** Shared actual Keystore policy/curve verification. No generation,
         * boolean authorization or original host/session permission is minted. */
        private static PinOwnerSigningMaterial signingMaterial(KeyStore store,String alias) throws Exception {
            java.security.Key value=store.getKey(alias,null);require(value instanceof java.security.PrivateKey);
            android.security.keystore.KeyInfo info=java.security.KeyFactory.getInstance("EC","AndroidKeyStore")
                .getKeySpec(value,android.security.keystore.KeyInfo.class);
            require(alias.equals(info.getKeystoreAlias()) && info.getKeySize()==256
                && info.getOrigin()==android.security.keystore.KeyProperties.ORIGIN_GENERATED
                && info.getPurposes()==android.security.keystore.KeyProperties.PURPOSE_SIGN
                && info.isUserAuthenticationRequired() && info.getUserAuthenticationValidityDurationSeconds()==-1
                && info.getUserAuthenticationType()==android.security.keystore.KeyProperties.AUTH_DEVICE_CREDENTIAL
                && info.isInsideSecureHardware() && info.isUserAuthenticationRequirementEnforcedBySecureHardware()
                && info.getDigests().length==1 && android.security.keystore.KeyProperties.DIGEST_SHA256.equals(info.getDigests()[0]));
            java.security.cert.Certificate certificate=store.getCertificate(alias);require(certificate!=null);
            java.security.PublicKey publicKey=certificate.getPublicKey();require(publicKey instanceof java.security.interfaces.ECPublicKey);
            java.security.AlgorithmParameters parameters=java.security.AlgorithmParameters.getInstance("EC");
            parameters.init(new java.security.spec.ECGenParameterSpec("secp256r1"));java.security.spec.ECParameterSpec expected=parameters.getParameterSpec(java.security.spec.ECParameterSpec.class);
            java.security.spec.ECParameterSpec actual=((java.security.interfaces.ECPublicKey)publicKey).getParams();
            require(actual.getCurve().equals(expected.getCurve()) && actual.getGenerator().equals(expected.getGenerator())
                && actual.getOrder().equals(expected.getOrder()) && actual.getCofactor()==expected.getCofactor());
            java.security.Signature signature=java.security.Signature.getInstance("SHA256withECDSA");signature.initSign((java.security.PrivateKey)value);

            return new PinOwnerSigningMaterial(publicKey,signature);
        }
        private void authenticate(OwnedPinOwnerRequest request,PinOwnerRecipient recipient) throws Exception {
            require(recipient!=null);synchronized(core){own(request);require(!request.started && !request.finished && !request.disposed);
                live(request);require(request.session.inspection.workers==0 && !request.session.inspection.retiring);
                request.started=true;Thread worker=new Thread(()->run(request,recipient),"planet-child-device-owner");request.worker=worker;
                request.session.inspection.workers++;request.session.inspection.threads.put(worker,1);
                try{worker.start();}catch(RuntimeException error){request.session.inspection.threads.remove(worker);
                    request.session.inspection.workers--;request.finished=true;request.sealed=true;request.wipe();core.sealUnknown(request.session.inspection);core.notifyAll();throw error;}}
        }
        private void main(OwnedPinOwnerRequest request,Runnable task) throws Exception {
            synchronized(core){own(request);require(!request.cleanupFenced || request.consumeCalls>0 || request.cleanupCalls>0);request.mainCalls++;}
            boolean accepted=new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{
                try{task.run();}catch(RuntimeException error){synchronized(core){request.mainError=error;request.sealed=true;request.revoked=true;}}
                finally{synchronized(core){request.mainCalls--;core.notifyAll();}}
            });
            if(!accepted){synchronized(core){request.mainCalls--;request.sealed=true;core.notifyAll();}throw new Unavailable();}
        }
        private void callback(OwnedPinOwnerRequest request,Runnable task) {
            synchronized(core){if(request.cleanupFenced){request.sealed=true;request.revoked=true;
                try{core.sealUnknown(request.session.inspection);}catch(Exception ignored){request.session.inspection.sealed=true;}core.notifyAll();return;}}
            try{main(request,task);}catch(Exception error){synchronized(core){request.sealed=true;request.revoked=true;core.notifyAll();}}
        }
        private void host(OwnedPinOwnerRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            for(;;){boolean[] valid={false},lost={false};main(request,()->{lost[0]=request.activity.isFinishing() || request.activity.isDestroyed()
                    || request.activity.getWindow().getDecorView().getWindowToken()!=request.windowToken;
                valid[0]=!lost[0] && request.activity.hasWindowFocus();});
                synchronized(core){while(request.mainCalls!=0)core.wait();live(request);
                    if(request.mainError!=null || lost[0])throw new PinKnownRefusal();if(valid[0])return;
                    // Wait for the OWNED system credential UI to return focus;
                    // never renew the original deadline or accept background.
                    if(!request.credentialReturned)throw new PinKnownRefusal();core.wait(50);}}
        }
        private static String label(OwnedPinOwnerRequest request,int id) {
            android.content.res.Configuration configuration=new android.content.res.Configuration(request.activity.getResources().getConfiguration());
            configuration.setLocale(new java.util.Locale(request.locale));return request.activity.createConfigurationContext(configuration).getString(id);
        }
        private void terminal(OwnedPinOwnerRequest request,android.hardware.biometrics.BiometricPrompt.AuthenticationResult result,Exception error) {
            synchronized(core){if(!request.promptOutstanding){request.sealed=true;request.revoked=true;core.notifyAll();return;}
                request.promptOutstanding=false;request.promptError=error;
                request.credentialReturned=result!=null && result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL
                    && result.getCryptoObject()==request.originalCrypto && result.getCryptoObject().getSignature()==request.originalSignature;
                if(error!=null || !request.credentialReturned)request.revoked=true;core.notifyAll();}
        }
        private void present(OwnedPinOwnerRequest request) throws Exception {
            main(request,()->{try{
                live(request);require(request.activity.getWindow().getDecorView().getWindowToken()==request.windowToken
                    && request.activity.hasWindowFocus() && !request.activity.isFinishing() && !request.activity.isDestroyed());
                request.activity.getApplication().registerActivityLifecycleCallbacks(lifecycle);observerRegistered=true;
                android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
                request.activity.registerReceiver(screenOff,filter);screenRegistered=true;
                require(deadlineHandler.postDelayed(deadlineCheck,50));
                android.hardware.biometrics.BiometricPrompt prompt=new android.hardware.biometrics.BiometricPrompt.Builder(request.activity)
                    .setTitle(label(request,request.session.inspection.action==PinLifecycleAction.enroll
                        ?R.string.native_owner_enroll_title:R.string.native_owner_recover_title))
                    .setSubtitle(label(request,R.string.native_owner_device_credential_reason))
                    .setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build();
                synchronized(core){live(request);request.promptOutstanding=true;}
                prompt.authenticate(request.originalCrypto,request.cancellation,task->callback(request,task),new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback(){
                    @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){terminal(request,result,null);}
                    @Override public void onAuthenticationError(int error,CharSequence message){terminal(request,null,new PinKnownRefusal());}
                });
            }catch(Exception error){synchronized(core){request.promptError=error;request.revoked=true;
                if(request.promptOutstanding)request.sealed=true;core.notifyAll();}cancel(request);}});
        }
        private boolean observerRegistered,screenRegistered;
        private final android.os.Handler deadlineHandler=new android.os.Handler(android.os.Looper.getMainLooper());
        private final Runnable deadlineCheck=new Runnable(){public void run(){OwnedPinOwnerRequest r=original;
            if(r==null)return;event(r,()->{if(SystemClock.elapsedRealtime()>=r.session.deadlineUptimeMs)cancel(r);
                synchronized(core){if(!r.detached && !r.retired && !deadlineHandler.postDelayed(this,50)){r.sealed=true;r.revoked=true;}}});}};
        private void event(OwnedPinOwnerRequest request,Runnable task) {
            synchronized(core){if(request!=original || request.retired || request.detached)return;
                try{core.own(request.session.inspection);}catch(Exception error){request.sealed=true;request.revoked=true;return;}
                request.eventCalls++;core.worker(request.session.inspection);}
            try{task.run();}finally{synchronized(core){request.eventCalls--;core.settleWorker(request.session.inspection);core.notifyAll();}}
        }
        private final android.content.BroadcastReceiver screenOff=new android.content.BroadcastReceiver(){
            @Override public void onReceive(Context context,android.content.Intent intent){OwnedPinOwnerRequest r=original;if(r!=null)event(r,()->cancel(r));}
        };
        private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(android.app.Activity a,android.os.Bundle b){} public void onActivityStarted(android.app.Activity a){}
            public void onActivityResumed(android.app.Activity a){} public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}
            public void onActivityPaused(android.app.Activity a){lifecycleLoss(a);} public void onActivityStopped(android.app.Activity a){lifecycleLoss(a);}
            public void onActivityDestroyed(android.app.Activity a){if(original!=null && a==original.activity)event(original,()->cancel(original));}
        };
        private void lifecycleLoss(android.app.Activity activity){OwnedPinOwnerRequest r=original;
            // Strict fail-closed: even a system credential implementation which
            // pauses its presenter is unsupported until a genuine original-host
            // transition authority is supplied. Home/background never unlatches.
            if(r!=null && activity==r.activity)event(r,()->cancel(r));}
        private void cancel(OwnedPinOwnerRequest request) {
            android.os.CancellationSignal signal; synchronized(core){if(request==null || request.owner!=this || original!=request)return;
                request.revoked=true;signal=request.cancellation;if(request.finished && request.consumeCalls==0)request.wipe();
                if(request.retired){core.notifyAll();return;}
                if(request.cancelIssued){core.notifyAll();return;}request.cancelIssued=true;
                request.cancelCalls++;}
            Thread cancel=new Thread(()->{try{if(signal!=null)signal.cancel();core.cancel(request.session.inspection);}
                catch(Exception error){synchronized(core){request.sealed=true;}}
                finally{synchronized(core){request.cancelCalls--;core.notifyAll();}}},"planet-child-device-owner-cancel");
            try{cancel.start();}catch(RuntimeException error){synchronized(core){request.cancelCalls--;request.sealed=true;core.notifyAll();}}
        }
        private void waitPrompt(OwnedPinOwnerRequest request) throws Exception {
            for(;;){boolean expire=false;synchronized(core){if(!request.promptOutstanding && request.mainCalls==0)break;
                if(SystemClock.elapsedRealtime()>=request.session.deadlineUptimeMs && !request.revoked)expire=true;
                if(!expire)core.wait(50);}
                if(expire)cancel(request);}
            synchronized(core){if(request.promptError!=null)throw request.promptError;require(request.credentialReturned);}
        }
        private void watch(OwnedPinOwnerRequest request) {
            Thread watcher=new Thread(()->{try{for(;;){boolean expired;synchronized(core){if(request.stopWatch)return;
                    expired=!request.revoked && SystemClock.elapsedRealtime()>=request.session.deadlineUptimeMs;
                    if(!expired){core.wait(50);continue;}}cancel(request);}}
                catch(InterruptedException error){synchronized(core){request.sealed=true;request.revoked=true;core.notifyAll();}cancel(request);Thread.currentThread().interrupt();}
            },"planet-child-device-owner-deadline");
            synchronized(core){request.watcher=watcher;}watcher.start();
        }
        private void verifySignature(OwnedPinOwnerRequest request,byte[] signature) throws Exception {
            require(signature!=null && signature.length>=8 && signature.length<=80 && request.publicKey!=null);
            byte[] actual=request.publicKey.getEncoded();try{require(MessageDigest.isEqual(actual,request.keyEncoding));}finally{Arrays.fill(actual,(byte)0);}
            java.security.Signature verify=java.security.Signature.getInstance("SHA256withECDSA");verify.initVerify(request.publicKey);
            verify.update(request.payload);require(verify.verify(signature));
        }
        private void joinAuth(OwnedPinOwnerRequest request) throws Exception {
            Thread watcher;synchronized(core){request.stopWatch=true;watcher=request.watcher;core.notifyAll();}
            boolean interrupted=false;
            if(watcher!=null)for(;;)try{watcher.join();break;}catch(InterruptedException error){interrupted=true;
                synchronized(core){request.revoked=true;request.sealed=true;}cancel(request);}
            synchronized(core){while(request.mainCalls!=0 || request.cancelCalls!=0 || request.promptOutstanding || request.eventCalls!=0)
                try{core.wait();}catch(InterruptedException error){interrupted=true;request.revoked=true;request.sealed=true;}
                request.cleanupFenced=true;if(interrupted)Thread.currentThread().interrupt();if(request.mainError!=null)throw request.mainError;}
        }
        /** Main-loop removal is an actual callback fence. While the caller holds
         * the vault mutation lock this MUST NOT wait for authority.cancel IO;
         * its independently counted worker remains until that IO actually returns. */
        private void detach(OwnedPinOwnerRequest request) throws Exception {
            boolean interrupted=false;synchronized(core){request.cleanupCalls++;}
            try{main(request,()->{deadlineHandler.removeCallbacks(deadlineCheck);
                if(screenRegistered){request.activity.unregisterReceiver(screenOff);screenRegistered=false;}
                if(observerRegistered){request.activity.getApplication().unregisterActivityLifecycleCallbacks(lifecycle);observerRegistered=false;}
                synchronized(core){request.detached=true;}});
                synchronized(core){while(request.mainCalls!=0 || request.eventCalls!=0)
                    try{core.wait();}catch(InterruptedException error){interrupted=true;request.revoked=true;request.sealed=true;}
                    if(request.mainError!=null)throw request.mainError;}
                if(interrupted)throw new InterruptedException("owner cleanup interrupted after actual callback join");
            }finally{synchronized(core){request.cleanupCalls--;core.notifyAll();}if(interrupted)Thread.currentThread().interrupt();}
        }
        private void run(OwnedPinOwnerRequest request,PinOwnerRecipient recipient) {
            byte[] signature=null;boolean delivered=false;
            try{watch(request);current(request);key(request);current(request);present(request);waitPrompt(request);current(request);
                request.originalSignature.update(request.payload);signature=request.originalSignature.sign();current(request);verifySignature(request,signature);current(request);
                synchronized(core){live(request);PinNativeReply backing=core.reply(request.session,new byte[0],request.session.checksum,PinSessionPhase.begun);
                    request.permission=new PinOwnerPermission(this,request,signature,backing);request.deliveryEntered=true;}
                recipient.completed(request.permission);current(request);delivered=true;
            }catch(Throwable error){boolean failureDelivery;synchronized(core){request.revoked=true;
                    if(request.deliveryEntered || !(error instanceof PinKnownRefusal))request.sealed=true;
                    if(request.permission!=null)request.permission.wipe();failureDelivery=!request.deliveryEntered;request.deliveryEntered=true;}
                cancel(request);if(failureDelivery)try{recipient.completed(null);}catch(Throwable ignored){synchronized(core){request.sealed=true;}}}
            finally{if(signature!=null)Arrays.fill(signature,(byte)0);
                try{joinAuth(request);}catch(Exception error){synchronized(core){request.sealed=true;request.revoked=true;}}
                synchronized(core){if(SystemClock.elapsedRealtime()>=request.session.deadlineUptimeMs)request.revoked=true;
                    request.deliveryCompleted=delivered&&!request.revoked&&!request.sealed;
                    if(request.sealed)try{core.sealUnknown(request.session.inspection);}catch(Exception ignored){request.session.inspection.sealed=true;}
                    if(request.revoked || request.disposed)request.wipe();core.settleWorker(request.session.inspection);
                    request.finished=true;core.notifyAll();}}
        }
        /** Called only by the existing original native mutation worker, usually
         * under the same vault lock. One-use burn precedes external callbacks.
         * No checkpoint write, retry promotion or cached control rollback occurs. */
        private void consume(PinOwnerPermission permission,OwnedPinSession session,byte[] next,String checksum,long revision) throws Exception {
            OwnedPinOwnerRequest request;byte[] signature; synchronized(core){require(permission!=null && permission.owner==this && original!=null
                && permission==original.permission && permission.request==original && !permission.disposed && !permission.consumed
                && permission.settled && permission.knownDelivery && permission.backing.settled);
                request=original;require(request.finished && request.deliveryCompleted
                    && request.session.inspection.phase==PinSessionPhase.committing && request.session.inspection.threads.containsKey(Thread.currentThread())
                    && request.session.inspection.workers==request.session.inspection.threads.get(Thread.currentThread()));permission.consumed=true;
                request.consumeCalls++;signature=permission.signature.clone();}
            try{require(request.session==session && next!=null && next.length==request.next.length && MessageDigest.isEqual(next,request.next)
                    && request.nextChecksum.equals(checksum) && revision==request.nextRevision);
                host(request);live(request);core.current(session,session.expected,session.checksum,session.revision);
                live(request);verifySignature(request,signature);live(request);
                core.current(session,session.expected,session.checksum,session.revision);host(request);live(request);
                detach(request);live(request);}
            finally{Arrays.fill(signature,(byte)0);synchronized(core){request.consumeCalls--;request.wipe();
                    if(request.detached && request.mainCalls==0 && request.eventCalls==0 && request.cancelCalls==0 && request.cleanupCalls==0)request.retired=true;core.notifyAll();}}
        }
        private void settle(PinOwnerPermission permission,PinReplyDelivery delivery) throws Exception {
            synchronized(core){require(permission!=null && permission.owner==this && original!=null && permission==original.permission
                && permission.request==original && !permission.settled && delivery!=null && original.finished
                && original.mainCalls==0 && original.cancelCalls==0 && original.consumeCalls==0 && original.eventCalls==0 && original.cleanupCalls==0
                && original.cleanupFenced && core.active==original.session.inspection
                && original.session.inspection.workers==0 && (delivery==PinReplyDelivery.uncertain || original.deliveryCompleted));
                core.settleReply(permission.backing,delivery);permission.settled=true;permission.knownDelivery=delivery==PinReplyDelivery.known;
                if(delivery==PinReplyDelivery.uncertain){original.sealed=true;permission.wipe();original.wipe();}core.notifyAll();}
        }
        private void retire(OwnedPinOwnerRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            synchronized(core){own(request);require(Thread.currentThread()!=request.worker && !request.session.inspection.threads.containsKey(Thread.currentThread()));}cancel(request);
            synchronized(core){if(!request.started){request.finished=true;request.cleanupFenced=true;}
                while(!request.finished || request.consumeCalls!=0 || request.permission!=null && !request.permission.settled)core.wait();
                if(request.retired){request.disposed=true;request.wipe();return;}core.own(request.session.inspection);core.worker(request.session.inspection);}
            boolean interrupted=false;Exception failure=null;
            try{detach(request);}catch(Exception error){failure=error;interrupted=Thread.interrupted();synchronized(core){request.sealed=true;request.revoked=true;}}
            synchronized(core){while(request.mainCalls!=0 || request.cancelCalls!=0 || request.eventCalls!=0 || request.cleanupCalls!=0)
                try{core.wait();}catch(InterruptedException error){interrupted=true;request.sealed=true;request.revoked=true;if(failure==null)failure=error;}
                if(failure==null && request.detached){request.retired=true;request.disposed=true;request.wipe();}
                else{request.sealed=true;core.sealUnknown(request.session.inspection);}
                core.settleWorker(request.session.inspection);core.notifyAll();}
            if(interrupted)Thread.currentThread().interrupt();if(failure!=null)throw failure;
        }
    }
    private static boolean nativeOwnerRetirementReady(OwnedPinInspection inspection) {
        OwnedPinOwnerRequest owner=inspection.ownerAuthorization;return owner==null || owner.retired;
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
            live(inspection); require(!inspection.retiring && inspection.workers==0 && nativeInputCommitReady(inspection)
                && inspection.phase==expected); inspection.phase=next; worker(inspection);
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
            OwnedPinOwnerRequest owner=reply.inspection.ownerAuthorization;
            if(owner!=null && owner.permission!=null && owner.permission.backing==reply)
                require(owner.finished && owner.cleanupFenced && owner.mainCalls==0 && owner.cancelCalls==0 && owner.consumeCalls==0
                    && owner.eventCalls==0 && owner.cleanupCalls==0
                    && reply.inspection.workers==0 && (delivery==PinReplyDelivery.uncertain || owner.deliveryCompleted));
            PinPrimitiveContext primitive=reply.inspection.primitiveContext;
            if(primitive!=null&&primitive.material!=null&&primitive.material.backing==reply)
                require(primitive.workers==0&&reply.inspection.workers==0&&nativeInputRetirementReady(reply.inspection));
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
                try{while(inspection.workers!=0 || inspection.transfers!=0 || !nativeInputRetirementReady(inspection) || !nativeOwnerRetirementReady(inspection))wait();inspection.retirementFenced=true;}
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
    /** Scoped real cryptographic primitives, still no input UI, bridge,
     * genuine checkpoint/parent authority, recovery or provider activation.
     * PINs stay in owned native byte arrays. No PIN String/log/analytics path.
     * SecretKeyFactory/SecureRandom/continuous clock are platform primitives; their
     * internal allocations are not claimed to be fully zeroizable by Java. */
    private interface PinPrimitiveCheck { void check() throws Exception; }
    private interface PinPrimitiveMaterialTask<T> { T run(byte[] disposable) throws Exception; }
    private interface PinPrimitivePlatform {
        long continuousNanos() throws Exception;
        void random(byte[] destination) throws Exception;
        void derive(byte[] pin,byte[] salt,long iterations,byte[] output,PinPrimitiveCheck check) throws Exception;
    }
    private static final class RealPinPrimitivePlatform implements PinPrimitivePlatform {
        private final java.security.SecureRandom random=new java.security.SecureRandom();
        public long continuousNanos() throws Exception { long value=SystemClock.elapsedRealtimeNanos();require(value>=0);return value; }
        public void random(byte[] destination) { random.nextBytes(destination); }
        public void derive(byte[] pin,byte[] salt,long iterations,byte[] output,PinPrimitiveCheck check) throws Exception {
            PinPlatformKdf.derive32(pin,salt,iterations,output,check);
        }
    }
    /** Fixed platform PBKDF2 only. Android documents SHA256 support from API26;
     * unavailable algorithms fail closed on API24/25, with no fallback/provider
     * installation. minSdk24 stays unchanged. App-owned bytes/chars and the
     * PBEKeySpec password are cleared; provider-internal heap erasure is not
     * promised. The synchronous platform operation keeps its native worker
     * until actual return; cancellation rejects and wipes a late output. */
    private static final class PinPlatformKdf {
        private static void derive32(byte[] pin,byte[] salt,long iterations,byte[] output,PinPrimitiveCheck check) throws Exception {
            require(pin!=null&&pin.length>=4&&pin.length<=128&&salt!=null&&salt.length==32
                &&iterations>=600000&&iterations<=Integer.MAX_VALUE&&output!=null&&output.length==32&&check!=null);
            for(byte digit:pin)require(digit>=48&&digit<=57);
            char[] password=new char[pin.length];byte[] ownedSalt=salt.clone(),encoded=null;
            javax.crypto.spec.PBEKeySpec spec=null;javax.crypto.SecretKey generated=null;boolean completed=false;
            try{for(int index=0;index<pin.length;index++)password[index]=(char)pin[index];
                check.check();spec=new javax.crypto.spec.PBEKeySpec(password,ownedSalt,(int)iterations,256);
                javax.crypto.SecretKeyFactory factory=javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
                generated=factory.generateSecret(spec);encoded=generated.getEncoded();require(encoded!=null&&encoded.length==32);
                check.check();System.arraycopy(encoded,0,output,0,32);completed=true;
            }finally{Arrays.fill(password,'\0');Arrays.fill(ownedSalt,(byte)0);if(encoded!=null)Arrays.fill(encoded,(byte)0);
                if(spec!=null)spec.clearPassword();if(!completed)Arrays.fill(output,(byte)0);
                // Public best-effort key destruction only; do not mask failure
                // or inspect a provider's private key copies.
                if(generated!=null)try{generated.destroy();}catch(Exception|LinkageError unavailable){/* no heap-erasure claim */}
            }
        }
    }
    private enum PinPrimitiveEntry { fresh, confirmation }
    private static final class PinPrimitiveContext implements AutoCloseable {
        final PinNativePrimitives owner;final NativePinSessions core;final OwnedPinSession session;final OwnedPinInspection inspection;
        final PinSessionPolicy policy;final PinLifecycleAction action;final String checksum,epoch,bootId;
        final long revision,hostGeneration,deadlineUptimeMs,capturedUptimeMs,capturedLogicalMs,iterations;
        private final byte[] expected,oldSalt,oldCredential;private boolean revoked,calibrationStarted,preparationStarted;
        private int workers;private PinPrimitiveInput fresh,confirmation;private PinPrimitiveCalibration calibration;private PinPrimitiveMaterial material;
        private PinNativeInputRequest nativeInputRequest;
        private PinPrimitiveContext(PinNativePrimitives owner,OwnedPinSession session,byte[] expected,byte[] oldSalt,byte[] oldCredential) {
            this.owner=owner;core=owner.core;this.session=session;inspection=session.inspection;policy=session.policy;action=inspection.action;
            checksum=session.checksum;epoch=session.epoch;bootId=session.bootId;revision=session.revision;hostGeneration=session.hostGeneration;
            deadlineUptimeMs=session.deadlineUptimeMs;capturedUptimeMs=session.capturedUptimeMs;capturedLogicalMs=session.capturedLogicalMs;iterations=policy.iterations;
            this.expected=expected.clone();this.oldSalt=oldSalt==null?null:oldSalt.clone();this.oldCredential=oldCredential==null?null:oldCredential.clone();
        }
        public void close() { owner.closeContext(this); }
    }
    private static final class PinPrimitiveInput implements AutoCloseable {
        final PinPrimitiveContext context;final PinPrimitiveEntry entry;private final byte[] bytes;private boolean taken,closed;
        private PinPrimitiveInput(PinPrimitiveContext context,PinPrimitiveEntry entry,byte[] bytes) { this.context=context;this.entry=entry;this.bytes=bytes.clone(); }
        private synchronized byte[] take() throws Exception { require(!taken&&!closed);taken=true;byte[] copy=bytes.clone();close();return copy; }
        public synchronized void close() { closed=true;Arrays.fill(bytes,(byte)0); }
    }
    private static final class PinPrimitiveCalibration implements AutoCloseable {
        final PinPrimitiveContext context;final long iterations;private final long[] elapsedNanos;private boolean consumed,closed;
        private PinPrimitiveCalibration(PinPrimitiveContext context,long[] measured) { this.context=context;iterations=context.iterations;elapsedNanos=measured.clone(); }
        public void close() { synchronized(context.core){closed=true;} }
    }
    /** close wipes the original backing transfer, and never settles it. Only
     * the missing genuine private host's original settlement event may release
     * a transfer; no caller receipt/boolean or material wrapper grants that. */
    private static final class PinPrimitiveMaterial implements AutoCloseable {
        final PinPrimitiveContext context;final PinNativeReply backing;final long iterations;
        private PinPrimitiveMaterial(PinPrimitiveContext context,PinNativeReply backing) { this.context=context;this.backing=backing;iterations=context.iterations; }
        private <T>T withBytes(PinPrimitiveMaterialTask<T> task) throws Exception { return context.owner.withMaterial(this,task); }
        public void close() { backing.close(); }
    }
    private static final class PinPrimitiveLease {
        final PinNativePrimitives owner;final PinPrimitiveContext context;final Thread thread;
        private boolean settled;private long lastNanos=-1,derivationStarted=-1;private PinPrimitiveCalibration calibration;
        private PinPrimitiveLease(PinNativePrimitives owner,PinPrimitiveContext context) { this.owner=owner;this.context=context;thread=Thread.currentThread(); }
    }
    private static final class PinNativePrimitives {
        private final NativePinSessions core;private final PinPrimitivePlatform platform;private final int minDigits,maxDigits;private final long maximumDerivationNanos;
        private PinPrimitiveContext context;private PinPrimitiveLease lease;
        private PinNativePrimitives(NativePinSessions core,int minDigits,int maxDigits,long maximumDerivationMs) throws Exception {
            this(core,minDigits,maxDigits,maximumDerivationMs,new RealPinPrimitivePlatform());
        }
        private PinNativePrimitives(NativePinSessions core,int minDigits,int maxDigits,long maximumDerivationMs,PinPrimitivePlatform platform) throws Exception {
            require(core!=null&&platform!=null&&minDigits>=4&&minDigits<=maxDigits&&maxDigits<=128
                &&maximumDerivationMs>=1&&maximumDerivationMs<=5000&&core.policy.iterations>=600000
                &&core.policy.iterations<=core.policy.maximumIterations&&core.policy.maximumIterations<=0xffffffffL
                &&core.policy.iterations<=Integer.MAX_VALUE);
            this.core=core;this.platform=platform;this.minDigits=minDigits;this.maxDigits=maxDigits;maximumDerivationNanos=maximumDerivationMs*1000000L;
        }
        /** Explicit B-only reflection fixture seam. Never selected by an App
         * flag/default factory; injected clocks/entropy/KDF supply no OS proof. */
        private static PinNativePrimitives syntheticFixture(NativePinSessions core,int minDigits,int maxDigits,long budget,PinPrimitivePlatform fixture) throws Exception {
            return new PinNativePrimitives(core,minDigits,maxDigits,budget,fixture);
        }
        private static void refuse(boolean allowed) throws PinKnownRefusal { if(!allowed)throw new PinKnownRefusal(); }
        private static boolean nonzero(byte[] bytes) { int any=0;for(byte value:bytes)any|=value;return any!=0; }
        private static byte[] hexBytes(String value) throws Exception { require(ProtectedEnvelope.hash(value));byte[] bytes=new byte[32];
            for(int index=0;index<32;index++)bytes[index]=(byte)((Character.digit(value.charAt(index*2),16)<<4)|Character.digit(value.charAt(index*2+1),16));return bytes; }
        private PinPrimitiveContext context(OwnedPinSession session) throws Exception {
            synchronized(core){require(session!=null&&session.owner==core&&session.inspection.session==session&&context==null
                    &&session.inspection.primitiveContext==null);
                core.sessionFence(session);require(!session.inspection.retiring&&session.inspection.phase==PinSessionPhase.begun
                    &&session.inspection.workers==0&&session.inspection.transfers==0);
                byte[] oldSalt=null,oldCredential=null;
                try(ProtectedEnvelope envelope=ProtectedEnvelope.decode(session.expected,session.policy.version,session.policy.checksum,session.policy.maximumIterations)){
                    require(envelope.checksum.equals(session.checksum)&&envelope.revision==session.revision);
                    if(!envelope.unenrolled){ProtectedEnvelope.Cursor cursor=new ProtectedEnvelope.Cursor(new String(envelope.canonical,envelope.pinStart,envelope.pinEnd-envelope.pinStart,StandardCharsets.US_ASCII));
                        ProtectedEnvelope.Pin old=ProtectedEnvelope.pin(cursor,session.policy.version,session.policy.maximumIterations);oldSalt=hexBytes(old.saltHex);oldCredential=hexBytes(old.credentialId);}
                    context=new PinPrimitiveContext(this,session,session.expected,oldSalt,oldCredential);session.inspection.primitiveContext=context;return context;
                }finally{if(oldSalt!=null)Arrays.fill(oldSalt,(byte)0);if(oldCredential!=null)Arrays.fill(oldCredential,(byte)0);}
            }
        }
        private void identity(PinPrimitiveContext candidate) throws Exception {
            require(candidate!=null&&candidate==context&&candidate.owner==this&&candidate.core==core
                &&candidate.session.owner==core&&candidate.inspection.owner==core&&candidate.inspection.session==candidate.session
                &&candidate.inspection.primitiveContext==candidate
                &&candidate.policy==core.policy&&candidate.session.policy==candidate.policy&&candidate.action==candidate.inspection.action
                &&candidate.checksum.equals(candidate.session.checksum)&&candidate.epoch.equals(candidate.session.epoch)
                &&candidate.bootId.equals(candidate.session.bootId)&&candidate.revision==candidate.session.revision
                &&candidate.hostGeneration==candidate.session.hostGeneration&&candidate.deadlineUptimeMs==candidate.session.deadlineUptimeMs
                &&candidate.capturedUptimeMs==candidate.session.capturedUptimeMs&&candidate.capturedLogicalMs==candidate.session.capturedLogicalMs
                &&candidate.iterations==core.policy.iterations);
        }
        /** Consumes bounded native bytes only. A future actual native UI must
         * clear its own input even on rejection; this is not such an input UI. */
        private PinPrimitiveInput entry(PinPrimitiveContext candidate,PinPrimitiveEntry entry,byte[] owned) throws Exception {
            require(owned!=null&&owned.length<=128);
            try{synchronized(core){identity(candidate);nativeInputOwnedOperation(candidate,null);core.sessionFence(candidate.session);
                    refuse(!candidate.revoked&&entry!=null&&candidate.workers==0&&!candidate.preparationStarted
                        &&!candidate.inspection.retiring&&candidate.inspection.phase==PinSessionPhase.begun);
                    require(owned.length>=minDigits&&owned.length<=maxDigits);for(byte value:owned)require(value>=48&&value<=57);
                    require(entry==PinPrimitiveEntry.fresh?candidate.fresh==null:candidate.confirmation==null);
                    PinPrimitiveInput result=new PinPrimitiveInput(candidate,entry,owned);
                    if(entry==PinPrimitiveEntry.fresh)candidate.fresh=result;else candidate.confirmation=result;return result;
                }}finally{Arrays.fill(owned,(byte)0);}
        }
        private PinPrimitiveLease start(PinPrimitiveContext candidate) throws Exception {
            return start(candidate,null);
        }
        private PinPrimitiveLease start(PinPrimitiveContext candidate,PinPrimitiveMaterial retained) throws Exception {
            synchronized(core){identity(candidate);nativeInputOwnedOperation(candidate,retained);core.live(candidate.inspection);
                refuse(!candidate.revoked&&!candidate.inspection.retiring&&candidate.inspection.phase==PinSessionPhase.begun);
                require(lease==null&&candidate.workers==0&&candidate.inspection.workers==0);
                if(retained==null)require(candidate.inspection.transfers==0);
                else {materialIdentity(retained);require(retained.context==candidate&&candidate.inspection.transfers==1);}
                lease=new PinPrimitiveLease(this,candidate);candidate.workers++;core.worker(candidate.inspection);return lease;}
        }
        private void local(PinPrimitiveLease owned) throws Exception {
            synchronized(core){identity(owned.context);require(owned.owner==this&&lease==owned&&!owned.settled&&owned.thread==Thread.currentThread()&&owned.context.workers==1);
                core.live(owned.context.inspection);refuse(!owned.context.revoked&&!owned.context.inspection.retiring
                    &&owned.context.inspection.phase==PinSessionPhase.begun&&!Thread.currentThread().isInterrupted());
                if(owned.calibration!=null)require(owned.calibration==owned.context.calibration&&owned.calibration.context==owned.context
                    &&owned.calibration.consumed&&!owned.calibration.closed);}
        }
        /** Local callback fence without decrypt/schema/full-record IO. Platform
         * KDF is synchronous; all actual clock/engine callbacks finish before
         * worker settlement, even after immediate cancellation revocation. */
        private long poll(PinPrimitiveLease owned) throws Exception {
            local(owned);long nanos=platform.continuousNanos();local(owned);
            require(nanos>=0&&nanos>=owned.lastNanos);long ms=nanos/1000000L;
            refuse(ms>=owned.context.capturedUptimeMs&&ms<owned.context.deadlineUptimeMs);
            if(owned.derivationStarted>=0)refuse(nanos>=owned.derivationStarted&&nanos-owned.derivationStarted<=maximumDerivationNanos);
            owned.lastNanos=nanos;return nanos;
        }
        private long current(PinPrimitiveLease owned) throws Exception {
            long before=poll(owned);
            PinNativeCoordinates point=core.io.locked(transaction->{local(owned);byte[] actual=transaction.read();
                try{require(actual!=null&&actual.length>0&&actual.length<=MAX_BYTES&&MessageDigest.isEqual(actual,owned.context.expected)
                        &&digest(actual).equals(owned.context.checksum));
                    PinNativeCoordinates coordinate=core.current(owned.context.session,actual,owned.context.checksum,owned.context.revision);
                    local(owned);require(MessageDigest.isEqual(actual,owned.context.expected)&&digest(actual).equals(owned.context.checksum));return coordinate;
                }finally{if(actual!=null)Arrays.fill(actual,(byte)0);}});
            long after=poll(owned);require(point.uptimeMs>=before/1000000L&&point.uptimeMs<=after/1000000L);return after;
        }
        private void random(PinPrimitiveLease owned,byte[] output) throws Exception {
            require(output.length>=1&&output.length<=128);current(owned);platform.random(output);current(owned);require(nonzero(output));
        }
        private long derive(PinPrimitiveLease owned,byte[] pin,byte[] salt,byte[] output) throws Exception {
            require(pin.length>=minDigits&&pin.length<=maxDigits&&salt.length==32&&output.length==32
                &&owned.context.iterations>=600000&&owned.context.iterations<=core.policy.maximumIterations);
            byte[] disposablePin=pin.clone(),disposableSalt=salt.clone();long before,after;
            try{before=current(owned);owned.derivationStarted=before;
                platform.derive(disposablePin,disposableSalt,owned.context.iterations,output,()->poll(owned));
                require(MessageDigest.isEqual(disposablePin,pin)&&MessageDigest.isEqual(disposableSalt,salt));
                after=poll(owned);current(owned);require(after>before&&after-before<=maximumDerivationNanos&&nonzero(output));return after-before;
            }finally{owned.derivationStarted=-1;Arrays.fill(disposablePin,(byte)0);Arrays.fill(disposableSalt,(byte)0);}
        }
        private void wipeContext(PinPrimitiveContext candidate) {
            if(!candidate.revoked)return;if(candidate.fresh!=null)candidate.fresh.close();if(candidate.confirmation!=null)candidate.confirmation.close();
            if(candidate.calibration!=null)candidate.calibration.closed=true;if(candidate.material!=null)candidate.material.close();
            if(candidate.workers==0){Arrays.fill(candidate.expected,(byte)0);if(candidate.oldSalt!=null)Arrays.fill(candidate.oldSalt,(byte)0);
                if(candidate.oldCredential!=null)Arrays.fill(candidate.oldCredential,(byte)0);}
        }
        private void closeContext(PinPrimitiveContext candidate) { synchronized(core){if(candidate!=null&&candidate.owner==this&&candidate==context){candidate.revoked=true;wipeContext(candidate);}} }
        private void finish(PinPrimitiveLease owned) throws Exception {
            synchronized(core){require(owned.owner==this&&lease==owned&&!owned.settled&&owned.thread==Thread.currentThread()&&owned.context.workers==1);
                owned.settled=true;owned.context.workers--;wipeContext(owned.context);lease=null;core.settleWorker(owned.context.inspection);}
        }
        private void failed(PinPrimitiveLease owned,Exception error) { synchronized(core){owned.context.revoked=true;wipeContext(owned.context);core.failed(owned.context.inspection,error,false);} }
        private PinPrimitiveCalibration calibrate(PinPrimitiveContext candidate) throws Exception {
            PinPrimitiveLease owned=start(candidate);byte[] dummy=new byte[maxDigits],salt=new byte[32],hash=new byte[32];long[] elapsed=new long[3];
            try{current(owned);synchronized(core){require(!candidate.calibrationStarted);candidate.calibrationStarted=true;}
                for(int sample=0;sample<3;sample++){random(owned,dummy);for(int index=0;index<dummy.length;index++)dummy[index]=(byte)(48+((dummy[index]&255)%10));
                    random(owned,salt);elapsed[sample]=derive(owned,dummy,salt,hash);Arrays.fill(dummy,(byte)0);Arrays.fill(salt,(byte)0);Arrays.fill(hash,(byte)0);}
                current(owned);synchronized(core){local(owned);candidate.calibration=new PinPrimitiveCalibration(candidate,elapsed);return candidate.calibration;}
            }catch(Exception error){failed(owned,error);throw error;}finally{Arrays.fill(dummy,(byte)0);Arrays.fill(salt,(byte)0);Arrays.fill(hash,(byte)0);Arrays.fill(elapsed,0);finish(owned);}
        }
        private PinPrimitiveMaterial prepare(PinPrimitiveContext candidate,PinPrimitiveCalibration calibration,PinPrimitiveInput fresh,PinPrimitiveInput confirmation) throws Exception {
            PinPrimitiveLease owned=start(candidate);byte[] first=null,second=null,salt=new byte[32],credential=new byte[32],hash=new byte[32],packed=new byte[96];
            try{current(owned);synchronized(core){require(!candidate.preparationStarted&&calibration!=null&&calibration==candidate.calibration&&calibration.context==candidate
                        &&calibration.iterations==candidate.iterations&&!calibration.closed&&!calibration.consumed
                        &&fresh!=null&&fresh!=confirmation&&fresh==candidate.fresh&&confirmation==candidate.confirmation
                        &&fresh.context==candidate&&confirmation.context==candidate&&fresh.entry==PinPrimitiveEntry.fresh&&confirmation.entry==PinPrimitiveEntry.confirmation);
                    candidate.preparationStarted=true;calibration.consumed=true;owned.calibration=calibration;}
                first=fresh.take();second=confirmation.take();refuse(MessageDigest.isEqual(first,second));
                random(owned,salt);random(owned,credential);
                require(!MessageDigest.isEqual(salt,credential)&&(candidate.oldSalt==null||!MessageDigest.isEqual(salt,candidate.oldSalt))
                    &&(candidate.oldCredential==null||!MessageDigest.isEqual(credential,candidate.oldCredential)));
                derive(owned,first,salt,hash);System.arraycopy(salt,0,packed,0,32);System.arraycopy(credential,0,packed,32,32);System.arraycopy(hash,0,packed,64,32);
                current(owned);synchronized(core){local(owned);require(candidate.material==null);
                    PinNativeReply reply=core.reply(candidate.session,packed,candidate.checksum,PinSessionPhase.begun);
                    candidate.material=new PinPrimitiveMaterial(candidate,reply);return candidate.material;}
            }catch(Exception error){failed(owned,error);throw error;}finally{if(first!=null)Arrays.fill(first,(byte)0);if(second!=null)Arrays.fill(second,(byte)0);
                if(fresh!=null)fresh.close();if(confirmation!=null)confirmation.close();Arrays.fill(salt,(byte)0);Arrays.fill(credential,(byte)0);
                Arrays.fill(hash,(byte)0);Arrays.fill(packed,(byte)0);finish(owned);}
        }
        private void materialIdentity(PinPrimitiveMaterial material) throws Exception {
            identity(material.context);require(material==material.context.material&&material.backing.owner==core&&material.backing.session==material.context.session
                &&material.backing.inspection==material.context.inspection&&material.backing.checksum.equals(material.context.checksum)
                &&material.context.inspection.pendingReplies.contains(material.backing)&&!material.backing.settled);
        }
        /** Synchronous future-private-host consumption only. Caller sees a
         * disposable verifier buffer which is wiped after actual callback
         * return, with current whole-record/deadline fences on both sides.
         * No native UI/transport/parent authorization is implemented here. */
        private <T>T withMaterial(PinPrimitiveMaterial material,PinPrimitiveMaterialTask<T> task) throws Exception {
            require(material!=null&&task!=null);PinPrimitiveLease owned=start(material.context,material);byte[] disposable=null,expected=null;
            try{current(owned);synchronized(core){local(owned);materialIdentity(material);disposable=material.backing.copyBytes();}
                require(disposable.length==96);expected=disposable.clone();T result=task.run(disposable);
                require(MessageDigest.isEqual(disposable,expected));current(owned);synchronized(core){local(owned);materialIdentity(material);}return result;
            }catch(Exception error){failed(owned,error);throw error;}finally{if(disposable!=null)Arrays.fill(disposable,(byte)0);
                if(expected!=null)Arrays.fill(expected,(byte)0);finish(owned);}
        }
        /** Existing private host settlement seam only; no implementation of
         * an authenticated native transport/ACK is supplied by this patch. */
        private void settleMaterial(PinPrimitiveMaterial material,PinReplyDelivery delivery) throws Exception {
            synchronized(core){materialIdentity(material);require(delivery!=null&&material.context.workers==0
                    &&material.context.inspection.workers==0);core.settleReply(material.backing,delivery);closeContext(material.context);}
        }
        private void cancel(PinPrimitiveContext candidate) throws Exception {
            synchronized(core){identity(candidate);closeContext(candidate);}core.cancel(candidate.inspection);
        }
    }
    /** Real primitives do not supply the still-missing genuine checkpoint,
     * original-host authority, UI input, calibration admission or recovery. */
    private static PinNativePrimitives actualSdkPinPrimitives(PlanetChildVault vault) { return null; }
    /** Actual private native views and byte-buffer entry, still unreachable
     * from production until a genuine owner/host/checkpoint factory exists.
     * No PluginMethod, JS PIN/boolean, IME, saved state or recovery substitute.
     * Original locale belongs to the original private request, never system
     * locale or a reconstructed caller DTO. Native display contains only count. */
    private interface PinNativeInputCompletion { void finished(PinNativeInputReceipt receipt) throws Exception; }
    /** The original UI slot spans the input-worker/prepare gaps and remains
     * joined through every real recipient callback and observer cleanup. */
    private static boolean nativeInputRetirementReady(OwnedPinInspection inspection) {
        PinNativeInputRequest request=inspection.primitiveContext==null?null:inspection.primitiveContext.nativeInputRequest;
        return request==null||request.owner==null||!request.started||request.owner.finished;
    }
    private static boolean nativeInputCommitReady(OwnedPinInspection inspection) {
        PinNativeInputRequest request=inspection.primitiveContext==null?null:inspection.primitiveContext.nativeInputRequest;
        return request==null||request.owner!=null&&request.owner.finished&&request.receipt!=null
            &&request.receipt.settled&&!request.cancelled;
    }
    private static void nativeInputOwnedOperation(PinPrimitiveContext context,PinPrimitiveMaterial retained) throws Exception {
        PinNativeInputRequest request=context.nativeInputRequest;if(request==null)return;
        require(request.context==context&&request.owner!=null);
        if(!request.owner.finished)require(request.owner.worker==Thread.currentThread()&&request.started&&!request.cancelled);
        else require(retained!=null&&request.owner.delivered&&request.receipt!=null&&!request.receipt.settled&&request.receipt.material==retained);
    }
    private static final class PinNativeInputRequest {
        final PinPrimitiveContext context;final PinPrimitiveCalibration calibration;final String locale;
        private PinNativeInput owner;private PinNativeInputReceipt receipt;private boolean started,cancelled;
        private PinNativeInputRequest(PinPrimitiveContext context,PinPrimitiveCalibration calibration,String locale) throws Exception {
            require(context!=null&&calibration!=null&&("ru".equals(locale)||"en".equals(locale)));
            synchronized(context.core){context.owner.identity(context);context.core.sessionFence(context.session);
                require(context.nativeInputRequest==null&&!context.revoked&&context.workers==0&&context.inspection.workers==0
                    &&context.inspection.transfers==0&&!context.inspection.retiring&&context.inspection.phase==PinSessionPhase.begun
                    &&calibration==context.calibration&&calibration.context==context&&!calibration.closed&&!calibration.consumed);
                this.context=context;this.calibration=calibration;this.locale=locale;context.nativeInputRequest=this;}
        }
    }
    /** Original prepared native material only; no plaintext input leaves this
     * component. close wipes but never ACKs, admits an action or frees capacity.
     * The genuine private caller adapter is still missing. */
    private static final class PinNativeInputReceipt implements AutoCloseable {
        final PinNativeInput owner;final PinNativeInputRequest request;final PinPrimitiveMaterial material;
        private boolean settled;
        private PinNativeInputReceipt(PinNativeInput owner,PinPrimitiveMaterial material) {
            this.owner=owner;request=owner.request;this.material=material;
        }
        private <T>T withMaterial(PinPrimitiveMaterialTask<T> task) throws Exception {
            synchronized(request.context.core){owner.receiptIdentity(this);require(owner.finished&&!settled);}
            return material.withBytes(task);
        }
        private void settle(PinReplyDelivery delivery) throws Exception {
            synchronized(request.context.core){owner.receiptIdentity(this);
                require(owner.finished&&owner.completionEntered&&!settled&&delivery!=null
                    &&(delivery==PinReplyDelivery.uncertain||owner.delivered)
                    &&owner.uiHandlers==0&&owner.pendingUi==0&&!owner.cancelInFlight);
                request.context.owner.settleMaterial(material,delivery);settled=true;}
        }
        public void close() { material.close(); }
    }
    private static final class PinNativeInput {
        private final PinNativeInputRequest request;private final PinPrimitiveContext context;
        private final android.app.Activity activity;private final android.app.Application application;
        private final PinNativeInputCompletion completion;private final android.os.Handler main;
        private final byte[] edit=new byte[128];private byte[] first,second;private int length,stage;
        private int uiHandlers,pendingUi;private boolean accepting,ready,cleanupQueued,uiEnded,shown,everFocused,observerRegistered,mismatchHint;
        private boolean cancelStarted,cancelInFlight,finished,delivered,timerArmed,completionEntered,hostActive;private Thread worker,cancelWorker;
        private android.os.IBinder activityToken;
        private android.app.Dialog dialog;private android.widget.TextView title,subtitle,mask,count;private android.widget.Button next;
        private android.widget.LinearLayout keypad;private android.view.ViewTreeObserver.OnWindowFocusChangeListener focusObserver;
        private final Runnable deadlineTask=()->uiEvent(()->{timerArmed=false;cancel();},true);
        private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(android.app.Activity a,android.os.Bundle state){}
            public void onActivityStarted(android.app.Activity a){}
            public void onActivityResumed(android.app.Activity a){}
            public void onActivityPaused(android.app.Activity a){if(a==activity)uiEvent(()->cancel(),true);}
            public void onActivityStopped(android.app.Activity a){if(a==activity)uiEvent(()->cancel(),true);}
            public void onActivityDestroyed(android.app.Activity a){if(a==activity)uiEvent(()->cancel(),true);}
            public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle ignored){if(a==activity)uiEvent(()->cancel(),true);}
        };
        private PinNativeInput(PinNativeInputRequest request,android.app.Activity activity,PinNativeInputCompletion completion) throws Exception {
            require(request!=null&&activity!=null&&completion!=null
                &&activity.getClass().getName().equals("ru.probpera.literaryplanet.MainActivity"));
            this.request=request;context=request.context;this.activity=activity;application=activity.getApplication();this.completion=completion;
            main=new android.os.Handler(android.os.Looper.getMainLooper());
            synchronized(context.core){identity();require(request.owner==null&&!request.started);request.owner=this;}
        }
        private void identity() throws Exception {
            context.owner.identity(context);require(context.nativeInputRequest==request&&request.context==context
                &&request.calibration==context.calibration&&request.calibration.context==context
                &&("ru".equals(request.locale)||"en".equals(request.locale)));
        }
        private void receiptIdentity(PinNativeInputReceipt receipt) throws Exception {
            identity();require(receipt!=null&&receipt.owner==this&&receipt.request==request&&request.receipt==receipt
                &&receipt.material.context==context&&context.material==receipt.material);
        }
        private void start() throws Exception {
            synchronized(context.core){identity();context.core.sessionFence(context.session);
                require(request.owner==this&&!request.started&&!request.cancelled&&!finished);
                request.started=true;worker=new Thread(this::work,"LiteraryPlanet-private-native-pin-input");worker.setDaemon(true);worker.start();}
        }
        /** Registration and settlement use the same actual main Thread.
         * The long-lived input worker also remains owned until these handlers
         * and real dismiss/observer cleanup have actually returned. */
        private void uiEvent(Runnable body,boolean terminal) {
            synchronized(context.core){if(finished)return;uiHandlers++;context.core.worker(context.inspection);}
            try{if(terminal)body.run();else{uiCheck();body.run();}}
            catch(Exception failure){cancel();}
            finally{synchronized(context.core){uiHandlers--;context.core.settleWorker(context.inspection);context.core.notifyAll();}}
        }
        private void uiCheck() throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());
            synchronized(context.core){identity();context.core.live(context.inspection);
                require(request.owner==this&&request.started&&!request.cancelled&&!context.revoked&&!context.inspection.retiring
                    &&(activityToken==null||hostActive));}
            long now=SystemClock.elapsedRealtime();require(now>=context.capturedUptimeMs&&now<context.deadlineUptimeMs);
            require(!activity.isFinishing()&&!activity.isDestroyed());
            if(activityToken!=null)require(activity.getWindow()!=null&&activity.getWindow().getDecorView().getWindowToken()==activityToken);
            // Dialog owns focus after show. Activity.hasWindowFocus is used
            // only during initial presentation, never for keypad events.
            if(shown)require(dialog!=null&&dialog.isShowing()&&dialog.getWindow()!=null
                &&dialog.getWindow().getAttributes().token==activityToken
                &&dialog.getWindow().getDecorView().getWindowToken()!=null&&dialog.getWindow().getDecorView().hasWindowFocus());
        }
        private void postUi(Runnable body) {
            synchronized(context.core){if(finished)return;pendingUi++;}
            if(!main.post(()->{try{uiEvent(body,true);}finally{synchronized(context.core){pendingUi--;context.core.notifyAll();}}})){
                synchronized(context.core){pendingUi--;request.cancelled=true;context.owner.closeContext(context);context.core.notifyAll();}
                // Missing actual main cleanup is not invented as completion.
                scheduleCancel();
            }
        }
        private void cancel() {
            synchronized(context.core){if(finished)return;request.cancelled=true;hostActive=false;accepting=false;Arrays.fill(edit,(byte)0);length=0;
                if(first!=null)Arrays.fill(first,(byte)0);if(second!=null)Arrays.fill(second,(byte)0);
                context.owner.closeContext(context);context.core.notifyAll();}
            queueCleanup();scheduleCancel();
        }
        private void scheduleCancel() {
            synchronized(context.core){if(cancelStarted||finished)return;cancelStarted=true;cancelInFlight=true;
                cancelWorker=new Thread(()->{try{context.core.cancel(context.inspection);}
                    catch(Exception failure){synchronized(context.core){context.core.failed(context.inspection,failure,false);}}
                    finally{synchronized(context.core){cancelInFlight=false;context.core.notifyAll();}}},"LiteraryPlanet-private-pin-cancel");
                cancelWorker.setDaemon(true);cancelWorker.start();}
        }
        private void queueCleanup() {
            synchronized(context.core){if(cleanupQueued||uiEnded||finished)return;cleanupQueued=true;}
            postUi(this::cleanupGui);
        }
        private void cleanupGui() {
            requireMain();accepting=false;Arrays.fill(edit,(byte)0);length=0;
            // Keep original deadline revocation armed through synchronous KDF
            // and material delivery; final observer detach removes the timer.
            if(mask!=null)mask.setText("");if(count!=null)count.setText("");if(next!=null)next.setEnabled(false);
            if(keypad!=null)clearButtons(keypad);
            android.app.Dialog owned=dialog;
            if(owned==null||!shown){synchronized(context.core){uiEnded=true;context.core.notifyAll();}return;}
            owned.setOnKeyListener(null);
            if(focusObserver!=null&&owned.getWindow()!=null){android.view.ViewTreeObserver observer=owned.getWindow().getDecorView().getViewTreeObserver();
                if(observer.isAlive())observer.removeOnWindowFocusChangeListener(focusObserver);focusObserver=null;}
            // A showing Dialog's OnDismiss callback, not this return/timeout,
            // provides the actual dismissal-completion condition.
            owned.dismiss();
        }
        private void dismissed() {
            if(!ready&&!request.cancelled)cancel();
            synchronized(context.core){uiEnded=true;shown=false;context.core.notifyAll();}
        }
        private static void clearButtons(android.view.View view) {
            view.setSaveEnabled(false);view.setOnClickListener(null);view.setEnabled(false);
            if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;
                for(int index=0;index<group.getChildCount();index++)clearButtons(group.getChildAt(index));}
        }
        private static void requireMain(){if(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper())throw new IllegalStateException("native-pin-ui-thread");}
        private int dp(int value){return Math.round(value*activity.getResources().getDisplayMetrics().density);}
        private android.content.Context localeContext() {
            android.content.res.Configuration config=new android.content.res.Configuration(activity.getResources().getConfiguration());
            config.setLocales(new android.os.LocaleList(java.util.Locale.forLanguageTag(request.locale)));
            return activity.createConfigurationContext(config);
        }
        private String label(int resource){return localeContext().getString(resource);}
        private android.widget.TextView text(android.content.Context ui,int sp,int color) {
            android.widget.TextView view=new android.widget.TextView(ui);view.setTextSize(sp);view.setTextColor(color);view.setSaveEnabled(false);
            view.setGravity(android.view.Gravity.CENTER);view.setPadding(0,dp(6),0,dp(6));return view;
        }
        private android.widget.Button button(android.content.Context ui,String publicLabel,Runnable press) {
            android.widget.Button view=new android.widget.Button(ui){
                @Override public boolean onFilterTouchEventForSecurity(android.view.MotionEvent event){
                    if((event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){
                        uiEvent(()->cancel(),true);return false;}return super.onFilterTouchEventForSecurity(event);}};
            view.setText(publicLabel);view.setContentDescription(publicLabel);
            view.setTextSize(20);view.setTextColor(0xfff7edda);view.setMinWidth(dp(64));view.setMinHeight(dp(64));view.setSaveEnabled(false);
            view.setFilterTouchesWhenObscured(true);
            android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();
            bg.setColor(0xff1d2940);bg.setCornerRadius(dp(14));bg.setStroke(dp(1),0xff46536b);view.setBackground(bg);
            view.setOnTouchListener((v,event)->{if((event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED
                    |android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){uiEvent(()->cancel(),true);return true;}return false;});
            view.setOnClickListener(v->uiEvent(press,false));return view;
        }
        private void present() {
            try{application.registerActivityLifecycleCallbacks(lifecycle);observerRegistered=true;
                require(activity.getWindow()!=null&&activity.hasWindowFocus()&&!activity.isFinishing()&&!activity.isDestroyed());
                activityToken=activity.getWindow().getDecorView().getWindowToken();require(activityToken!=null);hostActive=true;uiCheck();
                // Activity supplies the real window manager/token. All visible
                // labels are resolved separately from the original ru/en request.
                android.content.Context ui=new android.view.ContextThemeWrapper(activity,android.R.style.Theme_Material_Dialog_NoActionBar);
                android.app.Dialog owned=new android.app.Dialog(ui);dialog=owned;owned.setOwnerActivity(activity);owned.setCancelable(true);owned.setCanceledOnTouchOutside(false);
                android.widget.LinearLayout content=new android.widget.LinearLayout(ui);content.setOrientation(android.widget.LinearLayout.VERTICAL);
                content.setPadding(dp(20),dp(18),dp(20),dp(18));content.setSaveEnabled(false);content.setFilterTouchesWhenObscured(true);
                if(android.os.Build.VERSION.SDK_INT>=26)content.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                android.graphics.drawable.GradientDrawable panel=new android.graphics.drawable.GradientDrawable();panel.setColor(0xff101827);panel.setCornerRadius(dp(22));content.setBackground(panel);
                title=text(ui,22,0xfff3d69c);title.setText(label(R.string.native_pin_title));content.addView(title);
                subtitle=text(ui,15,0xffcad3e2);content.addView(subtitle);
                mask=text(ui,24,0xfff7edda);mask.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);content.addView(mask);
                count=text(ui,14,0xffb6c4d9);content.addView(count);
                keypad=new android.widget.LinearLayout(ui);keypad.setOrientation(android.widget.LinearLayout.VERTICAL);keypad.setSaveEnabled(false);content.addView(keypad);
                int[][] digits={{1,2,3},{4,5,6},{7,8,9}};
                for(int[] row:digits){android.widget.LinearLayout line=new android.widget.LinearLayout(ui);for(int digit:row){android.widget.Button key=button(ui,Integer.toString(digit),()->digit(digit));
                        android.widget.LinearLayout.LayoutParams cell=new android.widget.LinearLayout.LayoutParams(0,dp(64),1);cell.setMargins(dp(3),dp(3),dp(3),dp(3));line.addView(key,cell);}keypad.addView(line);}
                android.widget.LinearLayout bottom=new android.widget.LinearLayout(ui);
                for(android.widget.Button key:new android.widget.Button[]{button(ui,label(R.string.native_pin_delete),this::backspace),button(ui,"0",()->digit(0)),
                        button(ui,label(R.string.native_pin_cancel),this::cancel)}){android.widget.LinearLayout.LayoutParams cell=new android.widget.LinearLayout.LayoutParams(0,dp(64),1);
                    cell.setMargins(dp(3),dp(3),dp(3),dp(3));bottom.addView(key,cell);}keypad.addView(bottom);
                next=button(ui,label(R.string.native_pin_continue),this::continueInput);content.addView(next,new android.widget.LinearLayout.LayoutParams(-1,dp(64)));
                android.widget.ScrollView scroll=new android.widget.ScrollView(ui){
                    @Override public boolean onFilterTouchEventForSecurity(android.view.MotionEvent event){
                        if((event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){
                            uiEvent(()->cancel(),true);return false;}return super.onFilterTouchEventForSecurity(event);}};
                scroll.setSaveEnabled(false);scroll.setFilterTouchesWhenObscured(true);scroll.addView(content);
                owned.setContentView(scroll);require(owned.getWindow()!=null);
                owned.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
                owned.getWindow().getAttributes().token=activityToken;
                owned.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
                owned.setOnCancelListener(d->uiEvent(()->cancel(),true));owned.setOnDismissListener(d->uiEvent(this::dismissed,true));
                owned.setOnKeyListener((d,key,event)->{if(key==android.view.KeyEvent.KEYCODE_BACK){if(event.getAction()==android.view.KeyEvent.ACTION_UP)uiEvent(()->cancel(),true);return true;}return false;});
                synchronized(context.core){require(!request.cancelled);accepting=true;stage=0;}
                render();owned.show();shown=true;owned.getWindow().setLayout(Math.min(dp(360),activity.getResources().getDisplayMetrics().widthPixels-dp(32)),
                    Math.min(dp(680),activity.getResources().getDisplayMetrics().heightPixels-dp(64)));
                focusObserver=focused->{if(focused)everFocused=true;else if(everFocused&&shown)uiEvent(()->cancel(),true);};
                owned.getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(focusObserver);
                everFocused=owned.getWindow().getDecorView().hasWindowFocus();
                long remaining=context.deadlineUptimeMs-SystemClock.elapsedRealtime();require(remaining>0);
                timerArmed=true;require(main.postDelayed(deadlineTask,remaining));
            }catch(Exception failure){cancel();}
        }
        private void digit(int digit) {
            synchronized(context.core){if(!accepting||request.cancelled||length>=context.owner.maxDigits)return;
                edit[length++]=(byte)(48+digit);}render();
        }
        private void backspace() { synchronized(context.core){if(!accepting||request.cancelled||length==0)return;edit[--length]=0;}render(); }
        private void render() {
            int amount,currentStage;boolean retry;synchronized(context.core){amount=length;currentStage=stage;retry=mismatchHint;}
            subtitle.setText(label(retry?R.string.native_pin_mismatch:currentStage==0?R.string.native_pin_fresh:R.string.native_pin_confirmation));
            char[] bullets=new char[Math.min(amount,12)];Arrays.fill(bullets,'\u2022');mask.setText(new String(bullets));Arrays.fill(bullets,'\0');
            count.setText(localeContext().getString(R.string.native_pin_count,amount));next.setEnabled(amount>=context.owner.minDigits&&amount<=context.owner.maxDigits);
        }
        private void continueInput() {
            synchronized(context.core){if(!accepting||request.cancelled||length<context.owner.minDigits||length>context.owner.maxDigits)return;
                if(stage==0){first=Arrays.copyOf(edit,length);Arrays.fill(edit,(byte)0);length=0;stage=1;mismatchHint=false;}
                else{second=Arrays.copyOf(edit,length);Arrays.fill(edit,(byte)0);length=0;
                    if(!MessageDigest.isEqual(first,second)){Arrays.fill(first,(byte)0);Arrays.fill(second,(byte)0);
                        first=null;second=null;stage=0;mismatchHint=true;}
                    else{ready=true;accepting=false;context.core.notifyAll();}}}
            if(ready)queueCleanup();else render();
            if(mismatchHint)subtitle.announceForAccessibility(label(R.string.native_pin_mismatch));
        }
        private void awaitUi(PinPrimitiveLease lease) throws Exception {
            for(;;){synchronized(context.core){if(uiEnded&&pendingUi==0&&uiHandlers==0)return;context.core.wait(100);}
                if(!request.cancelled)context.owner.poll(lease);}
        }
        /** No deadline/close fabricates settlement: join actual main callback
         * and actual cancel return, even after terminal revocation. */
        private void joinActualUiAndCancel() {
            boolean interrupted=false;synchronized(context.core){while(!uiEnded||pendingUi!=0||uiHandlers!=0||cancelInFlight){
                    try{context.core.wait();}catch(InterruptedException ignored){interrupted=true;}}}
            if(interrupted)Thread.currentThread().interrupt();
        }
        private void detachObserver() {
            postUi(()->{if(timerArmed){main.removeCallbacks(deadlineTask);timerArmed=false;}
                if(observerRegistered){application.unregisterActivityLifecycleCallbacks(lifecycle);observerRegistered=false;}
                if(dialog!=null){dialog.setOnCancelListener(null);dialog.setOnDismissListener(null);}dialog=null;
                title=null;subtitle=null;mask=null;count=null;next=null;keypad=null;});
            joinActualUiAndCancel();
        }
        private void deliverFailure() {
            synchronized(context.core){if(completionEntered)return;completionEntered=true;context.core.worker(context.inspection);}
            try{completion.finished(null);}catch(Exception failure){synchronized(context.core){context.core.failed(context.inspection,failure,false);}}
            finally{synchronized(context.core){context.core.settleWorker(context.inspection);}}
        }
        private void work() {
            PinPrimitiveLease inputLease=null;boolean captured=false;
            try{inputLease=context.owner.start(context);context.owner.current(inputLease);postUi(this::present);awaitUi(inputLease);
                synchronized(context.core){require(ready&&!request.cancelled&&first!=null&&second!=null);}
                context.owner.current(inputLease);captured=true;
            }catch(Exception failure){if(inputLease!=null)context.owner.failed(inputLease,failure);cancel();}
            finally{queueCleanup();joinActualUiAndCancel();if(inputLease!=null)try{context.owner.finish(inputLease);}catch(Exception failure){cancel();captured=false;}}
            try{
                if(captured&&!request.cancelled){
                    PinPrimitiveInput fresh=context.owner.entry(context,PinPrimitiveEntry.fresh,first);
                    PinPrimitiveInput confirmation=context.owner.entry(context,PinPrimitiveEntry.confirmation,second);
                    PinPrimitiveMaterial material=context.owner.prepare(context,request.calibration,fresh,confirmation);
                    PinNativeInputReceipt receipt=new PinNativeInputReceipt(this,material);
                    synchronized(context.core){identity();require(!request.cancelled&&request.receipt==null);request.receipt=receipt;}
                    material.withBytes(disposable->{synchronized(context.core){require(!completionEntered);completionEntered=true;}
                        completion.finished(receipt);return null;});
                    synchronized(context.core){delivered=true;}
                }else deliverFailure();
            }catch(Exception failure){cancel();synchronized(context.core){if(request.receipt!=null)try{context.core.sealUnknown(context.inspection);}catch(Exception ignored){}}
                if(!completionEntered)deliverFailure();}
            finally{Arrays.fill(edit,(byte)0);if(first!=null)Arrays.fill(first,(byte)0);if(second!=null)Arrays.fill(second,(byte)0);
                detachObserver();synchronized(context.core){finished=true;context.core.notifyAll();}}
        }
    }
    /** A real private UI is not genuine checkpoint/action/admission authority.
     * Production stays unsupported and no plugin/route is activated here. */
    private static PinNativeInput actualSdkPinInput(PlanetChildVault vault) { return null; }
    /** Pure canonical attempt-journal planning only. These owned bytes do not
     * prove durable reservation/finalization, trusted time, a matching PIN,
     * checkpoint permission or Parent Gate admission. A future genuine private
     * verifier must durably charge the reservation BEFORE actual derivation,
     * retain it after cancellation/crash, and authenticate full-record readback.
     * No existing lifecycle, UI, KDF, storage or factory is activated here. */
    private enum PinAttemptCompletion { match, mismatch }
    private static final class PinAttemptReservation implements AutoCloseable {
        final PinAttemptJournal owner;final String challengeId,expectedChecksum,reservationChecksum;
        final long rootRevision,pinRevision,count,reservedAtMs,blockedUntilMs,delayMs;
        private final byte[] expected,reserved;private boolean consumed,closed;
        private PinAttemptReservation(PinAttemptJournal owner,String challenge,byte[] expected,byte[] reserved,
            long root,long pin,long count,long at,long blocked,long delay) throws Exception {
            this.owner=owner;challengeId=challenge;this.expected=expected;this.reserved=reserved;
            expectedChecksum=digest(expected);reservationChecksum=digest(reserved);rootRevision=root;pinRevision=pin;
            this.count=count;reservedAtMs=at;blockedUntilMs=blocked;delayMs=delay;
        }
        private void fence() throws Exception {
            require(!closed&&owner.reservation==this&&digest(expected).equals(expectedChecksum)
                &&digest(reserved).equals(reservationChecksum));
        }
        private byte[] copyExpectedBytes() throws Exception { synchronized(owner){owner.open();fence();require(!consumed);return expected.clone();} }
        private byte[] copyReservedBytes() throws Exception { synchronized(owner){owner.open();fence();require(!consumed);return reserved.clone();} }
        private void wipe() { closed=true;Arrays.fill(expected,(byte)0);Arrays.fill(reserved,(byte)0); }
        public void close() { synchronized(owner){wipe();} }
    }
    private static final class PinAttemptFinalization implements AutoCloseable {
        final PinAttemptJournal owner;final PinAttemptReservation reservation;final String checksum;
        private final byte[] canonical;private boolean closed;
        private PinAttemptFinalization(PinAttemptJournal owner,PinAttemptReservation original,byte[] owned) throws Exception {
            this.owner=owner;reservation=original;canonical=owned;checksum=digest(owned);
        }
        private byte[] copyCanonicalBytes() throws Exception { synchronized(owner){owner.open();
            require(!closed&&owner.finalization==this&&owner.reservation==reservation&&reservation.consumed
                &&digest(canonical).equals(checksum));return canonical.clone();} }
        private void wipe() { closed=true;Arrays.fill(canonical,(byte)0); }
        public void close() { synchronized(owner){wipe();} }
    }
    /** One original planning operation per owner. reserve/finalize are burned
     * before interpreting their untrusted operation arguments. close only
     * clears owned memory; it never generates a refund record or restores use. */
    private static final class PinAttemptJournal implements AutoCloseable {
        private final String version,policyChecksum;private final long maximumIterations;private final long[] delays;
        private PinAttemptReservation reservation;private PinAttemptFinalization finalization;
        private boolean reservationStarted,closed;
        private PinAttemptJournal(String version,String checksum,long maximumIterations,long[] delays) throws Exception {
            require(ProtectedEnvelope.identifier(version)&&ProtectedEnvelope.hash(checksum)&&maximumIterations>=600000
                &&maximumIterations<=0xffffffffL&&delays!=null&&delays.length>=1&&delays.length<=64);
            long[] owned=delays.clone();for(int i=0;i<owned.length;i++)require(owned[i]>0&&owned[i]<=MAX_SAFE&&(i==0||owned[i]>owned[i-1]));
            this.version=version;policyChecksum=checksum;this.maximumIterations=maximumIterations;this.delays=owned;
        }
        private void open() throws Exception { require(!closed); }
        private static long increment(long value) throws Exception { require(value>=0&&value<MAX_SAFE);return value+1; }
        private static long add(long value,long delay) throws Exception { require(value>=0&&value<=MAX_SAFE&&delay>0&&delay<=MAX_SAFE-value);return value+delay; }
        private static void observed(ProtectedEnvelope value,long at) throws Exception {
            require(at>=0&&at<=MAX_SAFE&&at>=value.logicalAnchorMs&&at>=value.lastObservedMs);
        }
        private synchronized PinAttemptReservation reserve(byte[] current,String challengeId,long sampledLogicalMs) throws Exception {
            open();require(!reservationStarted);reservationStarted=true;
            require(ProtectedEnvelope.hash(challengeId));ProtectedEnvelope before=null;byte[] expected=null,charged=null;
            try{before=ProtectedEnvelope.decode(current,version,policyChecksum,maximumIterations);require(!before.unenrolled);
                observed(before,sampledLogicalMs);if(sampledLogicalMs<before.blockedUntilMs)throw new PinKnownRefusal();
                long root=increment(before.revision),pin=increment(before.pinRevision),count=increment(before.count);
                long delay=delays[(int)Math.min(count-1,delays.length-1)],blocked=add(sampledLogicalMs,delay);
                expected=before.copyCanonicalBytes();charged=rebuild(before,expected,root,pin,count,blocked,sampledLogicalMs,challengeId);
                try(ProtectedEnvelope validated=ProtectedEnvelope.decode(charged,version,policyChecksum,maximumIterations)){
                    require(validated.revision==root&&validated.pinRevision==pin&&validated.count==count
                        &&validated.blockedUntilMs==blocked&&validated.lastObservedMs==sampledLogicalMs&&challengeId.equals(validated.pendingAttemptId));}
                PinAttemptReservation original=new PinAttemptReservation(this,challengeId,expected,charged,root,pin,count,sampledLogicalMs,blocked,delay);
                reservation=original;expected=null;charged=null;return original;
            }finally{if(before!=null)before.close();if(expected!=null)Arrays.fill(expected,(byte)0);if(charged!=null)Arrays.fill(charged,(byte)0);}
        }
        private synchronized PinAttemptFinalization finalizeAttempt(PinAttemptReservation original,byte[] current,
            PinAttemptCompletion completion,long sampledLogicalMs) throws Exception {
            open();require(original!=null&&original.owner==this&&reservation==original&&!original.consumed&&!original.closed);
            original.consumed=true;ProtectedEnvelope before=null;byte[] owned=null,completed=null;
            try{original.fence();require(completion!=null&&current!=null&&current.length>0&&current.length<=MAX_BYTES);
                owned=current.clone();require(MessageDigest.isEqual(owned,original.reserved));
                before=ProtectedEnvelope.decode(owned,version,policyChecksum,maximumIterations);
                require(!before.unenrolled&&before.revision==original.rootRevision&&before.pinRevision==original.pinRevision
                    &&before.count==original.count&&before.blockedUntilMs==original.blockedUntilMs&&before.lastObservedMs==original.reservedAtMs
                    &&original.challengeId.equals(before.pendingAttemptId));observed(before,sampledLogicalMs);
                long root=increment(before.revision),pin=increment(before.pinRevision);
                long count=completion==PinAttemptCompletion.match?0:original.count;
                long blocked=completion==PinAttemptCompletion.match?0:Math.max(original.blockedUntilMs,add(sampledLogicalMs,original.delayMs));
                completed=rebuild(before,owned,root,pin,count,blocked,sampledLogicalMs,null);
                try(ProtectedEnvelope validated=ProtectedEnvelope.decode(completed,version,policyChecksum,maximumIterations)){
                    require(validated.revision==root&&validated.pinRevision==pin&&validated.count==count&&validated.blockedUntilMs==blocked
                        &&validated.lastObservedMs==sampledLogicalMs&&validated.pendingAttemptId==null);}
                PinAttemptFinalization result=new PinAttemptFinalization(this,original,completed);finalization=result;completed=null;return result;
            }finally{if(before!=null)before.close();if(owned!=null)Arrays.fill(owned,(byte)0);if(completed!=null)Arrays.fill(completed,(byte)0);original.wipe();}
        }
        /** Narrowly reparse the already validated PIN slice to locate numeric
         * revision and attempts boundaries. No key search through profile text
         * and no platform JSON ordering/escaping or verifier reconstruction. */
        private static int[] pinSpans(ProtectedEnvelope envelope,byte[] canonical) throws Exception {
            String text=new String(canonical,envelope.pinStart,envelope.pinEnd-envelope.pinStart,StandardCharsets.UTF_8);
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(text);
            p.field("schemaVersion",true);p.number(1,1);p.field("policyVersion",false);p.string();
            p.field("revision",false);int revisionStart=p.byteOffset(p.index);p.number(1,MAX_SAFE);int revisionEnd=p.byteOffset(p.index);
            p.field("credentialId",false);p.string();p.field("verifier",false);
            p.field("algorithm",true);p.string();p.field("iterations",false);p.number(600000,0xffffffffL);
            p.field("saltHex",false);p.string();p.field("hashHex",false);p.string();p.token("}");
            p.field("attempts",false);int attemptsStart=p.byteOffset(p.index);
            p.field("count",true);p.number(0,MAX_SAFE);p.field("blockedUntilMs",false);p.number(0,MAX_SAFE);
            p.field("lastObservedMs",false);p.number(0,MAX_SAFE);p.field("pendingAttemptId",false);p.nullableString();p.token("}");
            int attemptsEnd=p.byteOffset(p.index);p.token("}");require(p.index==text.length());
            return new int[]{envelope.pinStart+revisionStart,envelope.pinStart+revisionEnd,envelope.pinStart+attemptsStart,envelope.pinStart+attemptsEnd};
        }
        private static byte[] rebuild(ProtectedEnvelope envelope,byte[] old,long root,long pin,long count,long blocked,long at,String pending) throws Exception {
            require(!envelope.unenrolled);int rootStart="{\"schemaVersion\":1,\"revision\":".getBytes(StandardCharsets.US_ASCII).length;
            int[] spans=pinSpans(envelope,old);byte[] rootBytes=Long.toString(root).getBytes(StandardCharsets.US_ASCII);
            byte[] pinBytes=Long.toString(pin).getBytes(StandardCharsets.US_ASCII);
            byte[] attemptBytes=("{\"count\":"+count+",\"blockedUntilMs\":"+blocked+",\"lastObservedMs\":"+at
                +",\"pendingAttemptId\":"+(pending==null?"null":"\""+pending+"\"")+"}").getBytes(StandardCharsets.US_ASCII);
            byte[] result=null;
            try{int size=old.length-(envelope.revisionEnd-rootStart)-(spans[1]-spans[0])-(spans[3]-spans[2])+rootBytes.length+pinBytes.length+attemptBytes.length;
                require(size>0&&size<=MAX_BYTES);result=new byte[size];int offset=0;
                offset=copy(old,0,rootStart,result,offset);offset=copy(rootBytes,0,rootBytes.length,result,offset);
                offset=copy(old,envelope.revisionEnd,spans[0],result,offset);offset=copy(pinBytes,0,pinBytes.length,result,offset);
                offset=copy(old,spans[1],spans[2],result,offset);offset=copy(attemptBytes,0,attemptBytes.length,result,offset);
                offset=copy(old,spans[3],old.length,result,offset);require(offset==size);byte[] owned=result;result=null;return owned;
            }finally{Arrays.fill(rootBytes,(byte)0);Arrays.fill(pinBytes,(byte)0);Arrays.fill(attemptBytes,(byte)0);if(result!=null)Arrays.fill(result,(byte)0);}
        }
        private static int copy(byte[] from,int start,int end,byte[] to,int at) throws Exception {
            require(start>=0&&end>=start&&end<=from.length&&at>=0&&end-start<=to.length-at);System.arraycopy(from,start,to,at,end-start);return at+end-start;
        }
        public synchronized void close() { closed=true;if(reservation!=null)reservation.wipe();if(finalization!=null)finalization.wipe();Arrays.fill(delays,0); }
    }
    /** Private verification mathematics only. No durable attempt charge,
     * trusted deadline/record readback, Parent Gate result or native authority
     * is supplied. A future verifier must reserve durably BEFORE calling this
     * one-use operation and retain its real native worker through all callbacks
     * and the synchronous KDF. Enrollment/UI/KDF factories remain unchanged. */
    private static final class PinVerifierIdentity {
        final String fullRecordChecksum,policyVersion,policyChecksum;
        final long recordRevision,pinRevision,exactIterations;
        private PinVerifierIdentity(ProtectedEnvelope record) {
            fullRecordChecksum=record.checksum;policyVersion=record.policyVersion;policyChecksum=record.policyChecksum;
            recordRevision=record.revision;pinRevision=record.pinRevision;exactIterations=record.iterations;
        }
    }
    private static final class PinVerifierMaterial implements AutoCloseable {
        final PinVerifierIdentity identity;private final byte[] canonical,salt,hash;
        private final String saltChecksum,hashChecksum;private PinVerificationMath owner;private boolean closed;
        private PinVerifierMaterial(PinVerifierIdentity identity,byte[] canonical,byte[] salt,byte[] hash) throws Exception {
            this.identity=identity;this.canonical=canonical;this.salt=salt;this.hash=hash;
            saltChecksum=digest(salt);hashChecksum=digest(hash);
        }
        /** Entire ordered envelope is validated before the narrowly bounded
         * verifier slice is read. No JSON reserialization or profile key search. */
        private static PinVerifierMaterial decode(byte[] bytes,String version,String checksum,long maximum) throws Exception {
            byte[] canonical=null,salt=null,hash=null;
            try(ProtectedEnvelope record=ProtectedEnvelope.decode(bytes,version,checksum,maximum)){
                require(!record.unenrolled);canonical=record.copyCanonicalBytes();
                ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(canonical,record.pinStart,record.pinEnd-record.pinStart,StandardCharsets.US_ASCII));
                p.field("schemaVersion",true);p.number(1,1);p.field("policyVersion",false);require(p.string().equals(version));
                p.field("revision",false);require(p.number(1,MAX_SAFE)==record.pinRevision);p.field("credentialId",false);p.string();
                p.field("verifier",false);p.field("algorithm",true);require(p.string().equals("PBKDF2-HMAC-SHA256"));
                p.field("iterations",false);require(p.number(600000,maximum)==record.iterations);
                p.field("saltHex",false);salt=hex(p.string());p.field("hashHex",false);hash=hex(p.string());p.token("}");
                PinVerifierMaterial original=new PinVerifierMaterial(new PinVerifierIdentity(record),canonical,salt,hash);
                canonical=null;salt=null;hash=null;return original;
            }finally{wipe(canonical);wipe(salt);wipe(hash);}
        }
        private static byte[] hex(String value) throws Exception {
            require(ProtectedEnvelope.hash(value));byte[] result=new byte[32];
            for(int i=0;i<32;i++)result[i]=(byte)((Character.digit(value.charAt(i*2),16)<<4)|Character.digit(value.charAt(i*2+1),16));return result;
        }
        private void fence() throws Exception {
            require(!closed&&identity!=null&&salt.length==32&&hash.length==32
                &&digest(canonical).equals(identity.fullRecordChecksum)&&digest(salt).equals(saltChecksum)&&digest(hash).equals(hashChecksum));
        }
        private static void wipe(byte[] bytes) { if(bytes!=null)Arrays.fill(bytes,(byte)0); }
        private void wipe() { closed=true;wipe(canonical);wipe(salt);wipe(hash); }
        public void close() { PinVerificationMath bound;synchronized(this){bound=owner;if(bound==null){wipe();return;}}bound.closeMaterial(this); }
    }
    /** Ownership helper for verification, deliberately separate from enrolled
     * fresh/confirmation inputs. Empty/non-ASCII values can be consumed and
     * refused here; this math layer cannot prove they were durably charged. */
    private static final class PinVerificationInput implements AutoCloseable {
        private final byte[] bytes;private boolean taken,closed;
        private PinVerificationInput(byte[] owned) throws Exception {
            require(owned!=null);try{require(owned.length<=128);bytes=owned.clone();}finally{Arrays.fill(owned,(byte)0);}
        }
        private synchronized byte[] take() throws Exception { require(!taken&&!closed);taken=true;byte[] moved=bytes.clone();close();return moved; }
        public synchronized void close() { closed=true;Arrays.fill(bytes,(byte)0); }
    }
    private interface PinVerificationCheck { void check(PinVerifierIdentity originalIdentity) throws Exception; }
    private interface PinVerificationEngine { void derive(byte[] pin,byte[] salt,long iterations,byte[] output,PinPrimitiveCheck check) throws Exception; }
    /** Fixed platform algorithm and exact configured count; no custom crypto,
     * SHA1 fallback, provider installation or API24/25 availability assertion.
     * Unlike enrollment, verification must accept every nonempty ASCII PIN
     * length1..128 so a short incorrect entry follows the charged-attempt flow.
     * Only app-owned arrays/spec password are claimed cleared, not provider heap. */
    private static final class PinVerificationPlatformKdf implements PinVerificationEngine {
        public void derive(byte[] pin,byte[] salt,long iterations,byte[] output,PinPrimitiveCheck check) throws Exception {
            require(pin!=null&&pin.length>=1&&pin.length<=128&&salt!=null&&salt.length==32
                &&iterations>=600000&&iterations<=Integer.MAX_VALUE&&output!=null&&output.length==32&&check!=null);
            for(byte digit:pin)require(digit>=48&&digit<=57);
            char[] password=new char[pin.length];byte[] ownedSalt=salt.clone(),encoded=null;
            javax.crypto.spec.PBEKeySpec spec=null;javax.crypto.SecretKey generated=null;boolean completed=false;
            try{for(int i=0;i<pin.length;i++)password[i]=(char)pin[i];check.check();
                spec=new javax.crypto.spec.PBEKeySpec(password,ownedSalt,(int)iterations,256);
                javax.crypto.SecretKeyFactory factory=javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
                generated=factory.generateSecret(spec);encoded=generated.getEncoded();require(encoded!=null&&encoded.length==32);
                check.check();System.arraycopy(encoded,0,output,0,32);completed=true;
            }finally{Arrays.fill(password,'\0');Arrays.fill(ownedSalt,(byte)0);PinVerifierMaterial.wipe(encoded);
                if(spec!=null)spec.clearPassword();if(!completed)Arrays.fill(output,(byte)0);
                if(generated!=null)try{generated.destroy();}catch(Exception|LinkageError unavailable){/* best effort, no heap-erasure claim */}
            }
        }
    }
    private enum PinVerificationOutcome { match, mismatch }
    private static final class PinVerificationComparison implements AutoCloseable {
        final PinVerifierIdentity identity;final boolean platformKdf;private final PinVerificationMath owner;
        private final PinVerificationOutcome outcome;private boolean closed;
        private PinVerificationComparison(PinVerificationMath owner,PinVerificationOutcome outcome) {
            this.owner=owner;identity=owner.material.identity;platformKdf=owner.platformKdf;this.outcome=outcome;
        }
        private PinVerificationOutcome mathematicalOutcome() throws Exception { synchronized(owner){
            require(!closed&&!owner.closed&&!owner.cancelled&&!owner.busy&&owner.result==this);return outcome;} }
        public void close() { synchronized(owner){closed=true;} }
    }
    /** Pure local exclusive lifetime, not a durable/native-session worker.
     * Caller check must authenticate the exact identity/current record and
     * original continuous deadline. It confers no authority on this class.
     * Cancel/close revoke immediately, but busy remains held until every actual
     * check and synchronous KDF returns and app-owned late buffers are wiped. */
    private static final class PinVerificationMath implements AutoCloseable {
        private final PinVerifierMaterial material;private final PinVerificationEngine engine;private final boolean platformKdf;
        private boolean started,busy,cancelled,closed;private PinVerificationComparison result;
        private PinVerificationMath(PinVerifierMaterial original) throws Exception { this(original,new PinVerificationPlatformKdf(),true); }
        private PinVerificationMath(PinVerifierMaterial original,PinVerificationEngine engine,boolean platform) throws Exception {
            require(original!=null&&engine!=null);material=original;this.engine=engine;platformKdf=platform;
            synchronized(original){original.fence();require(original.owner==null);original.owner=this;}
        }
        /** Explicit synthetic fixture seam, never a production selector. */
        private static PinVerificationMath syntheticFixture(PinVerifierMaterial original,PinVerificationEngine fixture) throws Exception {
            return new PinVerificationMath(original,fixture,false);
        }
        private synchronized void live() throws Exception { require(!cancelled&&!closed&&busy&&material.owner==this);material.fence(); }
        private void checked(PinVerificationCheck check) throws Exception {
            live();check.check(material.identity);live();
        }
        private PinVerificationComparison compare(PinVerifierMaterial original,PinVerificationInput input,PinVerificationCheck check) throws Exception {
            synchronized(this){require(original==material&&material.owner==this&&!closed&&!cancelled&&!started&&!busy);
                require(input!=null&&check!=null);started=true;busy=true;}
            byte[] pin=null,salt=null,expectedHash=null,pinFence=null,saltFence=null,derived=null;boolean completed=false;
            try{pin=input.take();require(pin.length>=1&&pin.length<=128);for(byte digit:pin)require(digit>=48&&digit<=57);
                synchronized(this){live();salt=material.salt.clone();expectedHash=material.hash.clone();}
                pinFence=pin.clone();saltFence=salt.clone();derived=new byte[32];checked(check);
                final byte[] borrowedPin=pin,borrowedSalt=salt,originalPin=pinFence,originalSalt=saltFence;
                PinPrimitiveCheck boundary=()->{require(MessageDigest.isEqual(borrowedPin,originalPin)&&MessageDigest.isEqual(borrowedSalt,originalSalt));checked(check);
                    require(MessageDigest.isEqual(borrowedPin,originalPin)&&MessageDigest.isEqual(borrowedSalt,originalSalt));};
                boundary.check();engine.derive(pin,salt,material.identity.exactIterations,derived,boundary);boundary.check();
                PinVerificationOutcome outcome=MessageDigest.isEqual(derived,expectedHash)?PinVerificationOutcome.match:PinVerificationOutcome.mismatch;
                // This is the last potentially injected callback. No callback
                // or synchronous engine is allowed after local busy settles.
                boundary.check();
                synchronized(this){live();result=new PinVerificationComparison(this,outcome);completed=true;return result;}
            }finally{input.close();PinVerifierMaterial.wipe(pin);PinVerifierMaterial.wipe(salt);PinVerifierMaterial.wipe(expectedHash);
                PinVerifierMaterial.wipe(pinFence);PinVerifierMaterial.wipe(saltFence);PinVerifierMaterial.wipe(derived);
                synchronized(this){material.wipe();if(!completed&&result!=null)result.close();busy=false;notifyAll();}
            }
        }
        private synchronized void cancel() { cancelled=true;if(result!=null)result.close();if(!busy)material.wipe();notifyAll(); }
        private synchronized void closeMaterial(PinVerifierMaterial original) {
            if(original!=material)return;cancelled=true;material.closed=true;if(result!=null)result.close();if(!busy)material.wipe();notifyAll();
        }
        public synchronized void close() { closed=true;cancel(); }
    }
    /** Private connected verification mechanics only. Genuine checkpoint,
     * host/action/time provenance and the verification UI adapter are absent.
     * No metadata, test callback, math result or delivery enum admits a Gate.
     * Production remains null; reuse is limited to existing locked IO, strict
     * canonical journal and fixed platform mathematics, not enrollment actions. */
    private static final class PinVerificationPolicy {
        final String version,checksum;final long maximumIterations;private final long[] delays;
        private PinVerificationPolicy(String version,String checksum,long maximum,long[] delays) throws Exception {
            require(ProtectedEnvelope.identifier(version)&&ProtectedEnvelope.hash(checksum)&&maximum>=600000&&maximum<=0xffffffffL
                &&delays!=null&&delays.length>=1&&delays.length<=64);long[] owned=delays.clone();
            for(int i=0;i<owned.length;i++)require(owned[i]>0&&owned[i]<=MAX_SAFE&&(i==0||owned[i]>owned[i-1]));
            this.version=version;this.checksum=checksum;maximumIterations=maximum;this.delays=owned;
        }
    }
    private static final class PinGateContext {
        final String profileId,policyVersion,mode,visibility;final long profileRevision,routeRevision;
        private PinGateContext(String profile,String policy,long profileRevision,long routeRevision,String mode,String visibility) throws Exception {
            require(ProtectedEnvelope.identifier(profile)&&ProtectedEnvelope.identifier(policy)&&profileRevision>=1&&profileRevision<=MAX_SAFE
                &&routeRevision>=0&&routeRevision<=MAX_SAFE&&"child".equals(mode)&&"active".equals(visibility));
            profileId=profile;policyVersion=policy;this.profileRevision=profileRevision;this.routeRevision=routeRevision;this.mode=mode;this.visibility=visibility;
        }
    }
    private static final class PinGateRequest {
        final Object originalHostChallenge;final String id,action,targetChecksum;final PinGateContext context;
        final long generation,deadlineUptimeMs;
        private PinGateRequest(Object original,String id,String action,String target,PinGateContext context,long generation,long deadline) throws Exception {
            require(original!=null&&ProtectedEnvelope.hash(id)&&ProtectedEnvelope.hash(target)&&context!=null&&generation>=0&&generation<=MAX_SAFE
                &&deadline>0&&deadline<=MAX_SAFE&&Arrays.asList("exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store",
                    "initiate-purchase","restore-purchases","open-external","share","account-change","export-child-data","delete-child-data","diagnostics",
                    "expand-access-settings","enable-licensed-pack","view-legal-commercial").contains(action));
            originalHostChallenge=original;this.id=id;this.action=action;targetChecksum=target;this.context=context;this.generation=generation;deadlineUptimeMs=deadline;
        }
    }
    private enum PinVerificationPhase { reserved,beginning,ready,verifying,finalized,blocked,denied,cancelled,sealed,closing,closed }
    private enum PinVerificationTransition { reserve,finalize }
    private enum PinVerificationDelivery { known,uncertain }
    private static final class PinVerificationKnownRefusal extends Exception {
        final boolean blocked;private PinVerificationKnownRefusal(boolean blocked){this.blocked=blocked;}
    }
    /** Required distinct genuine dependencies, deliberately unimplemented.
     * advance must durably consume the exact original one-use journal permission
     * BEFORE write. current(next) authenticates that selected checkpoint at
     * publication boundaries; separate exact readback proves the record write.
     * Cleanup also owns partially completed capture when lease is still null. */
    private interface PinVerificationAuthority {
        PinVerificationCoordinates capture(PinGateRequest gate,byte[] bytes,String checksum,long revision) throws Exception;
        PinVerificationCoordinates current(OwnedPinVerification owned,byte[] bytes,String checksum,long revision) throws Exception;
        Object authorizeTransition(OwnedPinVerification owned,PinVerificationTransition kind,byte[] expected,byte[] next,
            String expectedChecksum,String nextChecksum,long expectedRevision,long nextRevision) throws Exception;
        void advance(OwnedPinVerification owned,Object originalPermission,PinVerificationTransition kind,String checksum,long revision) throws Exception;
        void cancel(PinGateRequest gate,OwnedPinVerification owned) throws Exception;
        void retire(PinGateRequest gate,OwnedPinVerification owned) throws Exception;
    }
    private static final class PinVerificationCoordinates {
        final PinVerificationAuthority owner;final String epoch,bootId,checksum;final long revision,hostGeneration,uptimeMs,logicalMs;
        private PinVerificationCoordinates(PinVerificationAuthority owner,String epoch,String boot,String checksum,long revision,long host,long uptime,long logical) {
            this.owner=owner;this.epoch=epoch;bootId=boot;this.checksum=checksum;this.revision=revision;hostGeneration=host;uptimeMs=uptime;logicalMs=logical;
        }
    }
    private static final class PinVerificationTicket {
        final NativePinVerification owner;final PinGateRequest gate;PinVerificationPhase phase=PinVerificationPhase.reserved;
        boolean cancelled,sealed,retiring,retirementFenced,cancelCleanupStarted;int workers,transfers;OwnedPinVerification owned;PinVerificationReply terminal;
        private PinVerificationMath math;private PinVerificationNativeInputRequest nativeInputRequest;
        final java.util.Set<Object> permissions=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<Object,Boolean>());
        final java.util.IdentityHashMap<Thread,Integer> threads=new java.util.IdentityHashMap<>();
        final java.util.Set<PinVerificationReply> replies=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<PinVerificationReply,Boolean>());
        private PinVerificationTicket(NativePinVerification owner,PinGateRequest gate){this.owner=owner;this.gate=gate;}
    }
    private static final class OwnedPinVerification {
        final NativePinVerification owner;final PinVerificationTicket ticket;final PinGateRequest gate;final PinVerificationPolicy policy;
        final String checksum,epoch,bootId;final long revision,pinRevision,hostGeneration,capturedUptimeMs,capturedLogicalMs,deadlineUptimeMs,clockUptimeMs,clockLogicalMs;
        private final byte[] expected;private boolean closed;private long lastUptimeMs;private OwnedPinVerificationInput input;
        private OwnedPinVerification(NativePinVerification owner,PinVerificationTicket ticket,byte[] bytes,ProtectedEnvelope record,PinVerificationCoordinates point,long clockUptime) {
            this.owner=owner;this.ticket=ticket;gate=ticket.gate;policy=owner.policy;expected=bytes.clone();checksum=record.checksum;revision=record.revision;pinRevision=record.pinRevision;
            epoch=point.epoch;bootId=point.bootId;hostGeneration=point.hostGeneration;capturedUptimeMs=point.uptimeMs;lastUptimeMs=point.uptimeMs;capturedLogicalMs=point.logicalMs;
            deadlineUptimeMs=gate.deadlineUptimeMs;clockUptimeMs=clockUptime;clockLogicalMs=record.logicalAnchorMs;
        }
        private void wipe(){closed=true;Arrays.fill(expected,(byte)0);if(input!=null)input.close();}
    }
    /** Mechanical original-request binding only, not a genuine native UI. The
     * missing UI must attach that request before accepting any entered byte. */
    private static final class OwnedPinVerificationInput implements AutoCloseable {
        final NativePinVerification owner;final OwnedPinVerification owned;private final PinVerificationInput input;private boolean taken,closed;
        private OwnedPinVerificationInput(NativePinVerification owner,OwnedPinVerification owned,PinVerificationInput input){this.owner=owner;this.owned=owned;this.input=input;}
        private byte[] take() throws Exception { synchronized(owner){require(!closed&&!taken&&owned.input==this);taken=true;return input.take();} }
        public void close(){synchronized(owner){closed=true;input.close();}}
    }
    private static final class PinVerificationReply implements AutoCloseable {
        final NativePinVerification owner;final PinVerificationTicket ticket;final OwnedPinVerification owned;final boolean terminal,platformMath;
        final String checksum;private final PinVerificationOutcome comparison;private final byte[] bytes;private boolean closed,settled,deliveryStarted,deliveryCompleted;
        private PinVerificationReply(NativePinVerification owner,PinVerificationTicket ticket,OwnedPinVerification owned,byte[] bytes,String checksum,
            PinVerificationOutcome comparison,boolean terminal,boolean platform){this.owner=owner;this.ticket=ticket;this.owned=owned;this.bytes=bytes.clone();this.checksum=checksum;
            this.comparison=comparison;this.terminal=terminal;platformMath=platform;}
        private PinVerificationOutcome mathematicalOutcome() throws Exception { synchronized(owner){owner.replyFence(this);
            require(!terminal&&!closed&&!ticket.cancelled&&!ticket.sealed&&!ticket.retiring);return comparison;} }
        public void close(){synchronized(owner){closed=true;Arrays.fill(bytes,(byte)0);}}
    }
    private interface PinVerificationRecipient { void receive(PinVerificationReply original) throws Exception; }
    private static final class PinVerificationMutation {
        final NativePinVerification owner;final OwnedPinVerification owned;final PinVerificationTransition kind;final Object permission;
        final String expectedChecksum,nextChecksum;final long expectedRevision,nextRevision;boolean consumed;
        private PinVerificationMutation(NativePinVerification owner,OwnedPinVerification owned,PinVerificationTransition kind,Object permission,
            String expected,String next,long before,long after){this.owner=owner;this.owned=owned;this.kind=kind;this.permission=permission;
            expectedChecksum=expected;nextChecksum=next;expectedRevision=before;nextRevision=after;}
    }
    private static final class NativePinVerification {
        private final PinSessionIO io;private final PinVerificationAuthority authority;private final PinVerificationPolicy policy;
        private final PinVerificationEngine fixtureEngine;private PinVerificationTicket active;private final java.util.Set<String> usedIds=new java.util.HashSet<>();
        private final java.util.Set<Object> usedHosts=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        private NativePinVerification(PinSessionIO io,PinVerificationAuthority authority,PinVerificationPolicy policy) throws Exception {this(io,authority,policy,null);}
        private NativePinVerification(PinSessionIO io,PinVerificationAuthority authority,PinVerificationPolicy policy,PinVerificationEngine fixture) throws Exception {
            require(io!=null&&authority!=null&&policy!=null);this.io=io;this.authority=authority;this.policy=policy;fixtureEngine=fixture;
        }
        /** Explicit B-only synthetic engine seam; no flag selects this in App. */
        private static NativePinVerification syntheticFixture(PinSessionIO io,PinVerificationAuthority authority,PinVerificationPolicy policy,PinVerificationEngine engine) throws Exception {
            require(engine!=null);return new NativePinVerification(io,authority,policy,engine);
        }
        private static void refuse(boolean allowed,boolean blocked) throws PinVerificationKnownRefusal {if(!allowed)throw new PinVerificationKnownRefusal(blocked);}
        private static long add(long left,long right) throws Exception {require(left>=0&&right>=0&&left<=MAX_SAFE-right);return left+right;}
        private synchronized void own(PinVerificationTicket ticket) throws Exception {require(ticket!=null&&ticket.owner==this&&active==ticket&&ticket.phase!=PinVerificationPhase.closed);}
        private synchronized void live(PinVerificationTicket ticket) throws Exception {own(ticket);refuse(!ticket.cancelled&&!ticket.sealed&&!ticket.retiring,false);}
        private synchronized void lease(OwnedPinVerification owned) throws Exception {require(owned!=null&&owned.owner==this&&owned.policy==policy&&owned.gate==owned.ticket.gate
            &&owned.ticket.owned==owned&&!owned.closed&&digest(owned.expected).equals(owned.checksum));live(owned.ticket);}
        private void worker(PinVerificationTicket ticket){ticket.workers++;Thread thread=Thread.currentThread();ticket.threads.put(thread,ticket.threads.getOrDefault(thread,0)+1);}
        private synchronized void settledWorker(PinVerificationTicket ticket){ticket.workers--;Thread thread=Thread.currentThread();int left=ticket.threads.get(thread)-1;
            if(left==0)ticket.threads.remove(thread);else ticket.threads.put(thread,left);wipeSealed(ticket);notifyAll();}
        private void wipeSealed(PinVerificationTicket ticket){if(!ticket.sealed)return;for(PinVerificationReply reply:ticket.replies)reply.close();if(ticket.workers==0&&ticket.owned!=null)ticket.owned.wipe();}
        private synchronized void failed(PinVerificationTicket ticket,Exception error,boolean publication){
            if(ticket.sealed||publication||!(error instanceof PinVerificationKnownRefusal)){ticket.sealed=true;ticket.phase=PinVerificationPhase.sealed;}
            else ticket.phase=((PinVerificationKnownRefusal)error).blocked?PinVerificationPhase.blocked:ticket.cancelled?PinVerificationPhase.cancelled:PinVerificationPhase.denied;
            wipeSealed(ticket);notifyAll();
        }
        /** Preserve typed known refusal across the existing vault IO's generic
         * error wrapper, without changing its storage/enrollment semantics. */
        private <T>T locked(PinSessionTask<T> task) throws Exception {final PinVerificationKnownRefusal[] refusal={null};
            T result=io.locked(transaction->{try{return task.run(transaction);}catch(PinVerificationKnownRefusal known){refusal[0]=known;return null;}});
            if(refusal[0]!=null)throw refusal[0];return result;
        }
        private static <T>T isolated(byte[] original,PinBytesTask<T> callback) throws Exception {byte[] copy=original.clone();
            try{T result=callback.run(copy);require(MessageDigest.isEqual(copy,original));return result;}finally{Arrays.fill(copy,(byte)0);}}
        private void coordinates(PinVerificationCoordinates point,String checksum,long revision) throws Exception {require(point!=null&&point.owner==authority
            &&ProtectedEnvelope.hash(point.epoch)&&validBoot(point.bootId)&&checksum.equals(point.checksum)&&point.revision==revision
            &&point.hostGeneration>=0&&point.hostGeneration<=MAX_SAFE&&point.uptimeMs>=0&&point.uptimeMs<=MAX_SAFE&&point.logicalMs>=0&&point.logicalMs<=MAX_SAFE);}
        private static long clockUptime(ProtectedEnvelope record) throws Exception {ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(record.canonical,record.pinEnd,record.canonical.length-record.pinEnd,StandardCharsets.US_ASCII));
            p.field("clock",false);p.field("schemaVersion",true);p.number(1,1);p.field("bootId",false);p.string();p.field("uptimeAnchorMs",false);return p.number(0,MAX_SAFE);}
        private static String clockBoot(ProtectedEnvelope record) throws Exception {ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(record.canonical,record.pinEnd,record.canonical.length-record.pinEnd,StandardCharsets.US_ASCII));
            p.field("clock",false);p.field("schemaVersion",true);p.number(1,1);p.field("bootId",false);return p.string();}
        private static void context(ProtectedEnvelope record,PinGateRequest gate) throws Exception {ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(record.canonical,StandardCharsets.UTF_8));
            p.field("schemaVersion",true);p.number(1,1);p.field("revision",false);p.number(1,MAX_SAFE);p.field("mode",false);refuse(p.string().equals(gate.context.mode),false);
            p.field("selectionRevision",false);p.number(1,MAX_SAFE);p.field("profileRevision",false);refuse(p.number(1,MAX_SAFE)==gate.context.profileRevision,false);
            p.field("policyChecksum",false);p.string();p.field("registryChecksum",false);p.string();p.field("registry",false);p.field("schemaVersion",true);p.number(1,1);
            p.field("policyVersion",false);refuse(p.string().equals(gate.context.policyVersion),false);p.field("activeProfileId",false);refuse(gate.context.profileId.equals(p.nullableString()),false);}
        private PinVerificationCoordinates current(OwnedPinVerification owned,byte[] bytes,String checksum,long revision) throws Exception {
            lease(owned);require(digest(bytes).equals(checksum));PinVerificationCoordinates point=isolated(bytes,copy->authority.current(owned,copy,checksum,revision));
            lease(owned);coordinates(point,checksum,revision);require(digest(bytes).equals(checksum)&&point.epoch.equals(owned.epoch)&&point.bootId.equals(owned.bootId)
                &&point.hostGeneration==owned.hostGeneration&&point.logicalMs==add(owned.clockLogicalMs,point.uptimeMs-owned.clockUptimeMs));
            synchronized(this){lease(owned);refuse(point.uptimeMs>=owned.lastUptimeMs&&point.uptimeMs<owned.deadlineUptimeMs,false);owned.lastUptimeMs=point.uptimeMs;}return point;
        }
        private void background() throws Exception {if(fixtureEngine==null)require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());}
        private synchronized PinVerificationTicket ticket(PinGateRequest gate) throws Exception {require(gate!=null&&active!=null&&active.gate==gate);own(active);return active;}
        private OwnedPinVerification begin(PinGateRequest gate) throws Exception {
            background();PinVerificationTicket original;
            synchronized(this){require(gate!=null&&gate.context.policyVersion.equals(policy.version)&&usedIds.size()<2048&&usedHosts.size()<2048
                &&!usedIds.contains(gate.id)&&!usedHosts.contains(gate.originalHostChallenge));
                refuse(active==null,false);require(usedIds.add(gate.id)&&usedHosts.add(gate.originalHostChallenge));original=new PinVerificationTicket(this,gate);active=original;original.phase=PinVerificationPhase.beginning;worker(original);}
            try{return locked(transaction->{live(original);byte[] bytes=transaction.read();
                try(ProtectedEnvelope record=ProtectedEnvelope.decode(bytes,policy.version,policy.checksum,policy.maximumIterations)){
                    refuse(!record.unenrolled,false);context(record,gate);PinVerificationCoordinates point=isolated(bytes,copy->authority.capture(gate,copy,record.checksum,record.revision));
                    live(original);coordinates(point,record.checksum,record.revision);long clock=clockUptime(record);
                    require(digest(bytes).equals(record.checksum)&&clockBoot(record).equals(point.bootId)&&point.uptimeMs>=clock
                        &&point.logicalMs==add(record.logicalAnchorMs,point.uptimeMs-clock)&&point.logicalMs>=record.lastObservedMs);
                    refuse(point.uptimeMs<gate.deadlineUptimeMs,false);refuse(point.logicalMs>=record.blockedUntilMs,true);
                    OwnedPinVerification owned;synchronized(this){live(original);owned=new OwnedPinVerification(this,original,bytes,record,point,clock);original.owned=owned;}
                    current(owned,bytes,record.checksum,record.revision);
                    synchronized(this){lease(owned);original.phase=PinVerificationPhase.ready;}return owned;
                }finally{PinVerifierMaterial.wipe(bytes);}
            });}catch(Exception error){failed(original,error,false);throw error;}finally{settledWorker(original);}
        }
        private synchronized OwnedPinVerificationInput bindInput(OwnedPinVerification owned,PinVerificationInput raw) throws Exception {
            lease(owned);verificationNativeInputOperation(owned);require(raw!=null&&owned.ticket.phase==PinVerificationPhase.ready&&owned.ticket.workers==0&&owned.input==null);
            OwnedPinVerificationInput original=new OwnedPinVerificationInput(this,owned,raw);owned.input=original;return original;
        }
        private void exactCurrent(PinSessionTransaction transaction,OwnedPinVerification owned,byte[] expected,String checksum,long revision) throws Exception {
            lease(owned);byte[] actual=transaction.read();try{refuse(actual!=null&&MessageDigest.isEqual(actual,expected),false);
                require(digest(expected).equals(checksum));current(owned,expected,checksum,revision);}finally{PinVerifierMaterial.wipe(actual);}
        }
        private void mutationFence(PinVerificationMutation mutation,byte[] expected,byte[] next) throws Exception {
            lease(mutation.owned);require(mutation.owner==this&&mutation.permission!=null&&mutation.kind!=null
                &&digest(expected).equals(mutation.expectedChecksum)&&digest(next).equals(mutation.nextChecksum)
                &&mutation.expectedRevision<MAX_SAFE&&mutation.nextRevision==mutation.expectedRevision+1);
        }
        private void publish(PinSessionTransaction transaction,OwnedPinVerification owned,PinVerificationTransition kind,byte[] expected,byte[] next,
            String oldChecksum,String nextChecksum,long oldRevision,long nextRevision,boolean[] publication) throws Exception {
            exactCurrent(transaction,owned,expected,oldChecksum,oldRevision);
            try(ProtectedEnvelope before=ProtectedEnvelope.decode(expected,policy.version,policy.checksum,policy.maximumIterations);
                ProtectedEnvelope after=ProtectedEnvelope.decode(next,policy.version,policy.checksum,policy.maximumIterations)){
                require(before.revision==oldRevision&&after.revision==nextRevision&&nextRevision==add(oldRevision,1)
                    &&before.pinRevision<MAX_SAFE&&after.pinRevision==before.pinRevision+1);
                Object permission=isolated(expected,oldCopy->isolated(next,nextCopy->authority.authorizeTransition(owned,kind,oldCopy,nextCopy,oldChecksum,nextChecksum,oldRevision,nextRevision)));
                require(permission!=null);PinVerificationMutation mutation=new PinVerificationMutation(this,owned,kind,permission,oldChecksum,nextChecksum,oldRevision,nextRevision);
                mutationFence(mutation,expected,next);exactCurrent(transaction,owned,expected,oldChecksum,oldRevision);
                synchronized(this){lease(owned);require(!mutation.consumed&&owned.ticket.permissions.size()<2&&owned.ticket.permissions.add(permission));mutation.consumed=true;}
                publication[0]=true;authority.advance(owned,mutation.permission,kind,nextChecksum,nextRevision);mutationFence(mutation,expected,next);
                byte[] disposable=next.clone();try{CommitCheck boundary=()->{mutationFence(mutation,expected,next);
                        require(MessageDigest.isEqual(disposable,next));current(owned,next,nextChecksum,nextRevision);mutationFence(mutation,expected,next);require(MessageDigest.isEqual(disposable,next));};
                    // The selected checkpoint is next after advance. Do not
                    // authenticate expected against an already advanced epoch.
                    boundary.check();transaction.write(disposable,boundary);boundary.check();
                    byte[] readback=transaction.read();try{require(readback!=null&&MessageDigest.isEqual(readback,next));}finally{PinVerifierMaterial.wipe(readback);}
                    boundary.check();publication[0]=false;
                }finally{Arrays.fill(disposable,(byte)0);}
            }
        }
        private PinVerificationReply verify(OwnedPinVerification owned,OwnedPinVerificationInput input) throws Exception {
            background();synchronized(this){lease(owned);verificationNativeInputOperation(owned);require(input!=null&&input.owner==this&&input.owned==owned&&owned.input==input&&!input.closed&&!input.taken);
                require(owned.ticket.phase==PinVerificationPhase.ready&&owned.ticket.workers==0);owned.ticket.phase=PinVerificationPhase.verifying;worker(owned.ticket);}
            byte[] pin=null,expected=null,charged=null,finalBytes=null;PinAttemptJournal journal=null;PinVerifierMaterial material=null;
            PinVerificationMath math=null;PinVerificationComparison comparison=null;final boolean[] publication={false};
            try{pin=input.take();refuse(pin.length>=1&&pin.length<=128,false);expected=owned.expected.clone();journal=new PinAttemptJournal(policy.version,policy.checksum,policy.maximumIterations,policy.delays);
                final byte[] before=expected;final PinAttemptJournal planner=journal;
                PinAttemptReservation reservation=locked(transaction->{exactCurrent(transaction,owned,before,owned.checksum,owned.revision);
                    PinVerificationCoordinates point=current(owned,before,owned.checksum,owned.revision);PinAttemptReservation original=planner.reserve(before,owned.gate.id,point.logicalMs);
                    byte[] next=original.copyReservedBytes();try{publish(transaction,owned,PinVerificationTransition.reserve,before,next,owned.checksum,original.reservationChecksum,
                        owned.revision,original.rootRevision,publication);return original;}finally{Arrays.fill(next,(byte)0);}});
                charged=reservation.copyReservedBytes();final byte[] reserved=charged;PinVerificationOutcome outcome=PinVerificationOutcome.mismatch;boolean platform=false;
                boolean digits=true;for(byte value:pin)digits&=value>=48&&value<=57;
                // Even malformed bounded nonempty input has now been charged.
                // Cancellation never resets that durable reservation.
                lease(owned);
                if(digits){material=PinVerifierMaterial.decode(charged,policy.version,policy.checksum,policy.maximumIterations);
                    math=fixtureEngine==null?new PinVerificationMath(material):PinVerificationMath.syntheticFixture(material,fixtureEngine);
                    synchronized(this){lease(owned);owned.ticket.math=math;}
                    PinVerificationInput moved=new PinVerificationInput(pin.clone());
                    try{comparison=math.compare(material,moved,identity->{lease(owned);require(identity.fullRecordChecksum.equals(reservation.reservationChecksum)
                            &&identity.recordRevision==reservation.rootRevision&&identity.pinRevision==reservation.pinRevision);
                        locked(transaction->{exactCurrent(transaction,owned,reserved,reservation.reservationChecksum,reservation.rootRevision);return null;});});}
                    finally{moved.close();}lease(owned);outcome=comparison.mathematicalOutcome();platform=comparison.platformKdf;
                }
                Arrays.fill(pin,(byte)0);pin=null;final PinAttemptCompletion completion=outcome==PinVerificationOutcome.match?PinAttemptCompletion.match:PinAttemptCompletion.mismatch;
                PinAttemptFinalization finalization=locked(transaction->{exactCurrent(transaction,owned,reserved,reservation.reservationChecksum,reservation.rootRevision);
                    PinVerificationCoordinates point=current(owned,reserved,reservation.reservationChecksum,reservation.rootRevision);
                    PinAttemptFinalization original=planner.finalizeAttempt(reservation,reserved,completion,point.logicalMs);byte[] next=original.copyCanonicalBytes();
                    try(ProtectedEnvelope record=ProtectedEnvelope.decode(next,policy.version,policy.checksum,policy.maximumIterations)){
                        publish(transaction,owned,PinVerificationTransition.finalize,reserved,next,reservation.reservationChecksum,original.checksum,reservation.rootRevision,record.revision,publication);
                        return original;
                    }finally{Arrays.fill(next,(byte)0);}});
                finalBytes=finalization.copyCanonicalBytes();synchronized(this){lease(owned);PinVerificationReply reply=new PinVerificationReply(this,owned.ticket,owned,finalBytes,finalization.checksum,outcome,false,platform);
                    owned.ticket.replies.add(reply);owned.ticket.transfers++;owned.ticket.phase=PinVerificationPhase.finalized;return reply;}
            }catch(Exception error){failed(owned.ticket,error,publication[0]);throw error;}
            finally{input.close();if(comparison!=null)comparison.close();if(math!=null)math.close();if(material!=null)material.close();if(journal!=null)journal.close();
                PinVerifierMaterial.wipe(pin);PinVerifierMaterial.wipe(expected);PinVerifierMaterial.wipe(charged);PinVerifierMaterial.wipe(finalBytes);
                synchronized(this){if(owned.ticket.math==math)owned.ticket.math=null;}settledWorker(owned.ticket);}
        }
        private synchronized void replyFence(PinVerificationReply reply) throws Exception {require(reply!=null&&reply.owner==this);own(reply.ticket);
            require(!reply.settled&&reply.ticket.replies.contains(reply)&&reply.owned==reply.ticket.owned);}
        private void deliver(PinVerificationReply reply,PinVerificationRecipient recipient) throws Exception {
            background();byte[] finalRecord;synchronized(this){replyFence(reply);require(recipient!=null&&!reply.closed&&!reply.deliveryStarted&&reply.ticket.workers==0);
                if(!reply.terminal){verificationNativeInputOperation(reply.owned);live(reply.ticket);}finalRecord=reply.bytes.clone();reply.deliveryStarted=true;worker(reply.ticket);}
            try{if(!reply.terminal)locked(transaction->{try(ProtectedEnvelope record=ProtectedEnvelope.decode(finalRecord,policy.version,policy.checksum,policy.maximumIterations)){
                    exactCurrent(transaction,reply.owned,finalRecord,reply.checksum,record.revision);}return null;});
                recipient.receive(reply);
                synchronized(this){replyFence(reply);if(!reply.closed)require(MessageDigest.isEqual(reply.bytes,finalRecord));}
                if(!reply.terminal)locked(transaction->{try(ProtectedEnvelope record=ProtectedEnvelope.decode(finalRecord,policy.version,policy.checksum,policy.maximumIterations)){
                    exactCurrent(transaction,reply.owned,finalRecord,reply.checksum,record.revision);}return null;});
                synchronized(this){replyFence(reply);if(!reply.terminal)live(reply.ticket);reply.deliveryCompleted=true;}
            }catch(Exception error){failed(reply.ticket,error,true);throw error;}finally{Arrays.fill(finalRecord,(byte)0);settledWorker(reply.ticket);}
        }
        /** Immediate local revocation is safe on UI thread. Actual authority
         * cleanup remains a counted background operation, not synthetic ACK. */
        private synchronized void revoke(PinGateRequest gate) throws Exception {PinVerificationTicket original=ticket(gate);original.cancelled=true;
            // Math caller fences observe this flag before any IO and after the
            // real synchronous KDF; no generic math.cancel error is mistaken
            // for an unknown journal/authority failure or refunded attempt.
            if(original.workers==0&&original.owned!=null&&original.owned.input!=null)original.owned.input.close();notifyAll();}
        private void cancel(PinGateRequest gate) throws Exception {background();PinVerificationTicket original;
            synchronized(this){original=ticket(gate);revoke(gate);if(original.cancelCleanupStarted||original.retirementFenced)return;original.cancelCleanupStarted=true;worker(original);}
            try{locked(transaction->{authority.cancel(gate,original.owned);return null;});}catch(Exception error){failed(original,error,false);throw error;}finally{settledWorker(original);}
        }
        private synchronized void settleReply(PinVerificationReply reply,PinVerificationDelivery delivery) throws Exception {replyFence(reply);require(delivery!=null&&reply.ticket.workers==0&&verificationNativeInputFinished(reply.ticket));
            // Never-started abandonment may drain its original transfer only
            // as uncertain; it sticky-seals and establishes no delivered ACK.
            if(delivery==PinVerificationDelivery.known)require(reply.deliveryCompleted);
            if(reply.terminal)require(reply.ticket.terminal==reply&&reply.ticket.retirementFenced&&reply.ticket.transfers==1);
            reply.settled=true;reply.close();reply.ticket.replies.remove(reply);reply.ticket.transfers--;
            if(delivery==PinVerificationDelivery.uncertain||!reply.terminal&&reply.ticket.cancelled){reply.ticket.sealed=true;reply.ticket.phase=PinVerificationPhase.sealed;}
            wipeSealed(reply.ticket);if(reply.terminal&&!reply.ticket.sealed){reply.ticket.phase=PinVerificationPhase.closed;active=null;}notifyAll();
        }
        private synchronized void sealUnknown(PinGateRequest gate) throws Exception {PinVerificationTicket original=ticket(gate);original.sealed=true;original.phase=PinVerificationPhase.sealed;
            wipeSealed(original);notifyAll();}
        private PinVerificationReply retire(PinGateRequest gate) throws Exception {background();PinVerificationTicket original;
            synchronized(this){original=ticket(gate);require(!original.retiring&&!original.threads.containsKey(Thread.currentThread()));original.retiring=true;
                if(original.workers==0&&original.owned!=null&&original.owned.input!=null)original.owned.input.close();
                try{while(original.workers!=0||original.transfers!=0||!verificationNativeInputFinished(original))wait();original.retirementFenced=true;}
                catch(InterruptedException interrupted){original.sealed=true;original.phase=PinVerificationPhase.sealed;wipeSealed(original);Thread.currentThread().interrupt();throw new Unavailable();}}
            try{locked(transaction->{authority.retire(gate,original.owned);return null;});}
            catch(Exception error){failed(original,error,true);throw error;}
            synchronized(this){require(original.workers==0&&original.transfers==0);if(original.owned!=null)original.owned.wipe();
                PinVerificationReply terminal=new PinVerificationReply(this,original,original.owned,new byte[0],null,null,true,false);
                original.terminal=terminal;original.replies.add(terminal);original.transfers++;if(!original.sealed)original.phase=PinVerificationPhase.closing;notifyAll();return terminal;}
        }
    }
    /** Actual private keypad ownership, not genuine input/host admission.
     * The future admitted caller must supply the original verification lease.
     * All existing factories remain unsupported; no bridge is installed. */
    private static final class PinVerificationNativeInputRequest {
        final OwnedPinVerification owned;final PinGateRequest gate;final String locale;
        private PinVerificationNativeInput owner;private boolean started;private volatile boolean cancelled;
        private PinVerificationNativeInputRequest(OwnedPinVerification owned,String locale) throws Exception {
            require(owned!=null&&("ru".equals(locale)||"en".equals(locale)));
            synchronized(owned.owner){owned.owner.lease(owned);require(owned.ticket.phase==PinVerificationPhase.ready
                &&owned.ticket.workers==0&&owned.ticket.transfers==0&&owned.input==null&&owned.ticket.nativeInputRequest==null);
                this.owned=owned;gate=owned.gate;this.locale=locale;}
        }
    }
    private interface PinVerificationNativeInputCompletion { void finished(PinVerificationReply originalOrNull) throws Exception; }
    private static void verificationNativeInputOperation(OwnedPinVerification owned) throws Exception {
        PinVerificationNativeInputRequest request=owned.ticket.nativeInputRequest;if(request==null)return;require(request.owner!=null);if(request.owner.finished)return;
        require(request.owned==owned&&request.gate==owned.gate&&request.started&&!request.cancelled
            &&request.owner.worker==Thread.currentThread()&&request.owner.inputLeaseFinished);
    }
    private static boolean verificationNativeInputFinished(PinVerificationTicket ticket) {
        return ticket.nativeInputRequest==null||ticket.nativeInputRequest.owner!=null&&ticket.nativeInputRequest.owner.finished;
    }
    private static final class PinVerificationNativeInput {
        private final PinVerificationNativeInputRequest request;private final OwnedPinVerification owned;private final NativePinVerification core;
        private final android.app.Activity activity;private final android.app.Application application;
        private final PinVerificationNativeInputCompletion completion;private final android.os.Handler main;
        private final byte[] edit=new byte[128];private byte[] entered;private int length,uiHandlers,pendingUi;
        private boolean accepting,ready,cleanupQueued,uiEnded,shown,everFocused,observerRegistered,hostActive;
        private boolean cancelStarted,cancelInFlight,inputLeaseFinished,finished,completionEntered,delivered,timerArmed;
        private Thread worker,cancelWorker;private PinVerificationReply reply;private android.os.IBinder activityToken;
        private android.app.Dialog dialog;private android.widget.TextView title,actionCaption,prompt,mask,count;private android.widget.Button next;
        private android.widget.LinearLayout keypad;private android.view.ViewTreeObserver.OnWindowFocusChangeListener focusObserver;
        private final Runnable deadlineTask=()->uiEvent(()->{timerArmed=false;cancel();},true);
        private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(android.app.Activity a,android.os.Bundle state){}
            public void onActivityStarted(android.app.Activity a){}
            public void onActivityResumed(android.app.Activity a){}
            public void onActivityPaused(android.app.Activity a){if(a==activity)uiEvent(thisInput()::cancel,true);}
            public void onActivityStopped(android.app.Activity a){if(a==activity)uiEvent(thisInput()::cancel,true);}
            public void onActivityDestroyed(android.app.Activity a){if(a==activity)uiEvent(thisInput()::cancel,true);}
            public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle state){if(a==activity)uiEvent(thisInput()::cancel,true);}
        };
        private PinVerificationNativeInput thisInput(){return this;}
        private PinVerificationNativeInput(PinVerificationNativeInputRequest request,android.app.Activity activity,
            PinVerificationNativeInputCompletion completion) throws Exception {
            require(request!=null&&activity!=null&&completion!=null
                &&activity.getClass().getName().equals("ru.probpera.literaryplanet.MainActivity"));
            this.request=request;owned=request.owned;core=owned.owner;this.activity=activity;application=activity.getApplication();this.completion=completion;
            main=new android.os.Handler(android.os.Looper.getMainLooper());
            synchronized(core){core.lease(owned);require(request.owner==null&&!request.started&&owned.ticket.nativeInputRequest==null
                    &&owned.ticket.phase==PinVerificationPhase.ready&&owned.ticket.workers==0&&owned.ticket.transfers==0&&owned.input==null);
                request.owner=this;owned.ticket.nativeInputRequest=request;request.started=true;
                worker=new Thread(this::work,"LiteraryPlanet-private-verification-input");worker.setDaemon(true);worker.start();}
        }
        private void identity() throws Exception {require(request.owner==this&&request.owned==owned&&request.gate==owned.gate
            &&owned.ticket.nativeInputRequest==request&&request.started&&("ru".equals(request.locale)||"en".equals(request.locale)));core.own(owned.ticket);}
        private void currentInput() throws Exception {synchronized(core){identity();core.lease(owned);require(worker==Thread.currentThread()&&!inputLeaseFinished);}
            core.locked(transaction->{core.exactCurrent(transaction,owned,owned.expected,owned.checksum,owned.revision);return null;});}
        private void uiEvent(Runnable body,boolean terminal) {
            synchronized(core){if(finished)return;uiHandlers++;core.worker(owned.ticket);}
            try{if(terminal)body.run();else{uiCheck();body.run();}}
            catch(Exception failure){cancel();}
            finally{synchronized(core){uiHandlers--;core.settledWorker(owned.ticket);core.notifyAll();}}
        }
        private void uiCheck() throws Exception {
            requireMain();synchronized(core){identity();core.live(owned.ticket);require(!request.cancelled&&!owned.closed&&(activityToken==null||hostActive));}
            long now=SystemClock.elapsedRealtime();require(now>=owned.capturedUptimeMs&&now<owned.deadlineUptimeMs);
            require(!activity.isFinishing()&&!activity.isDestroyed());
            if(activityToken!=null)require(activity.getWindow()!=null&&activity.getWindow().getDecorView().getWindowToken()==activityToken);
            // The owned Dialog legitimately takes focus from the Activity.
            if(shown)require(dialog!=null&&dialog.isShowing()&&dialog.getWindow()!=null&&dialog.getWindow().getAttributes().token==activityToken
                &&dialog.getWindow().getDecorView().getWindowToken()!=null&&dialog.getWindow().getDecorView().hasWindowFocus());
        }
        private void postUi(Runnable body) {
            synchronized(core){if(finished)return;pendingUi++;}
            if(!main.post(()->{try{uiEvent(body,true);}finally{synchronized(core){pendingUi--;core.notifyAll();}}})){
                synchronized(core){pendingUi--;request.cancelled=true;try{core.sealUnknown(request.gate);}catch(Exception ignored){}core.notifyAll();}
                // A rejected cleanup dispatch is never invented as joined UI.
                scheduleCancel();
            }
        }
        private void cancel() {
            synchronized(core){if(finished)return;request.cancelled=true;hostActive=false;accepting=false;Arrays.fill(edit,(byte)0);length=0;
                PinVerifierMaterial.wipe(entered);try{core.revoke(request.gate);}catch(Exception ignored){}core.notifyAll();}
            queueCleanup();scheduleCancel();
        }
        private void scheduleCancel() {
            synchronized(core){if(cancelStarted||finished)return;cancelStarted=true;cancelInFlight=true;
                cancelWorker=new Thread(()->{try{core.cancel(request.gate);}catch(Exception failure){core.failed(owned.ticket,failure,false);}
                    finally{synchronized(core){cancelInFlight=false;core.notifyAll();}}},"LiteraryPlanet-private-verification-cancel");
                cancelWorker.setDaemon(true);cancelWorker.start();}
        }
        private void queueCleanup() {synchronized(core){if(cleanupQueued||uiEnded||finished)return;cleanupQueued=true;}postUi(this::cleanupGui);}
        private void cleanupGui() {
            requireMain();synchronized(core){accepting=false;Arrays.fill(edit,(byte)0);length=0;}
            // Original expiry remains armed through KDF and recipient delivery.
            if(mask!=null)mask.setText("");if(count!=null)count.setText("");if(next!=null)next.setEnabled(false);if(keypad!=null)clearButtons(keypad);
            android.app.Dialog original=dialog;if(original==null||!shown){synchronized(core){uiEnded=true;core.notifyAll();}return;}
            original.setOnKeyListener(null);
            if(focusObserver!=null&&original.getWindow()!=null){android.view.ViewTreeObserver observer=original.getWindow().getDecorView().getViewTreeObserver();
                if(observer.isAlive())observer.removeOnWindowFocusChangeListener(focusObserver);focusObserver=null;}
            original.dismiss(); // Actual OnDismiss completion owns uiEnded.
        }
        private void dismissed() {synchronized(core){if(!ready&&!request.cancelled)cancel();uiEnded=true;shown=false;core.notifyAll();}}
        private static void requireMain(){if(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper())throw new IllegalStateException("verification-pin-ui-thread");}
        private static void clearButtons(android.view.View view){view.setSaveEnabled(false);view.setOnClickListener(null);view.setEnabled(false);
            if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++)clearButtons(group.getChildAt(i));}}
        private int dp(int value){return Math.round(value*activity.getResources().getDisplayMetrics().density);}
        private android.content.Context localeContext(){android.content.res.Configuration config=new android.content.res.Configuration(activity.getResources().getConfiguration());
            config.setLocales(new android.os.LocaleList(java.util.Locale.forLanguageTag(request.locale)));return activity.createConfigurationContext(config);}
        private String label(int resource){return localeContext().getString(resource);}
        private static int actionResource(String action) throws Exception {
            switch(action){case "exit-child-mode":return R.string.native_pin_verify_exit_child_mode;case "switch-adult-profile":return R.string.native_pin_verify_switch_adult_profile;
                case "change-exact-age":return R.string.native_pin_verify_change_exact_age;case "change-blocked-topics":return R.string.native_pin_verify_change_blocked_topics;
                case "open-adult-store":return R.string.native_pin_verify_open_adult_store;case "initiate-purchase":return R.string.native_pin_verify_initiate_purchase;
                case "restore-purchases":return R.string.native_pin_verify_restore_purchases;case "open-external":return R.string.native_pin_verify_open_external;
                case "share":return R.string.native_pin_verify_share;case "account-change":return R.string.native_pin_verify_account_change;
                case "export-child-data":return R.string.native_pin_verify_export_child_data;case "delete-child-data":return R.string.native_pin_verify_delete_child_data;
                case "diagnostics":return R.string.native_pin_verify_diagnostics;case "expand-access-settings":return R.string.native_pin_verify_expand_access_settings;
                case "enable-licensed-pack":return R.string.native_pin_verify_enable_licensed_pack;case "view-legal-commercial":return R.string.native_pin_verify_view_legal_commercial;
                default:throw new Unavailable();}
        }
        private android.widget.TextView text(android.content.Context ui,int sp,int color){android.widget.TextView view=new android.widget.TextView(ui);
            view.setTextSize(sp);view.setTextColor(color);view.setSaveEnabled(false);view.setGravity(android.view.Gravity.CENTER);view.setPadding(0,dp(6),0,dp(6));return view;}
        private android.widget.Button button(android.content.Context ui,String publicLabel,Runnable press){android.widget.Button view=new android.widget.Button(ui){
                @Override public boolean onFilterTouchEventForSecurity(android.view.MotionEvent event){if(obscured(event)){uiEvent(thisInput()::cancel,true);return false;}return super.onFilterTouchEventForSecurity(event);}};
            view.setText(publicLabel);view.setContentDescription(publicLabel);view.setTextSize(20);view.setTextColor(0xfff7edda);view.setMinWidth(dp(64));view.setMinHeight(dp(64));
            view.setSaveEnabled(false);view.setFilterTouchesWhenObscured(true);android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();
            bg.setColor(0xff1d2940);bg.setCornerRadius(dp(14));bg.setStroke(dp(1),0xff46536b);view.setBackground(bg);
            view.setOnTouchListener((v,event)->{if(obscured(event)){uiEvent(this::cancel,true);return true;}return false;});view.setOnClickListener(v->uiEvent(press,false));return view;}
        private static boolean obscured(android.view.MotionEvent event){return(event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0;}
        private void present() {
            try{application.registerActivityLifecycleCallbacks(lifecycle);observerRegistered=true;
                require(activity.getWindow()!=null&&activity.hasWindowFocus()&&!activity.isFinishing()&&!activity.isDestroyed());
                activityToken=activity.getWindow().getDecorView().getWindowToken();require(activityToken!=null);hostActive=true;uiCheck();
                android.content.Context ui=new android.view.ContextThemeWrapper(activity,android.R.style.Theme_Material_Dialog_NoActionBar);
                android.app.Dialog original=new android.app.Dialog(ui);dialog=original;original.setOwnerActivity(activity);original.setCancelable(true);original.setCanceledOnTouchOutside(false);
                android.widget.LinearLayout content=new android.widget.LinearLayout(ui);content.setOrientation(android.widget.LinearLayout.VERTICAL);content.setPadding(dp(20),dp(18),dp(20),dp(18));
                content.setSaveEnabled(false);content.setFilterTouchesWhenObscured(true);if(android.os.Build.VERSION.SDK_INT>=26)content.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                android.graphics.drawable.GradientDrawable panel=new android.graphics.drawable.GradientDrawable();panel.setColor(0xff101827);panel.setCornerRadius(dp(22));content.setBackground(panel);
                title=text(ui,22,0xfff3d69c);title.setText(label(R.string.native_pin_title));content.addView(title);
                actionCaption=text(ui,17,0xfff3d69c);actionCaption.setText(label(actionResource(request.gate.action)));content.addView(actionCaption);
                prompt=text(ui,15,0xffcad3e2);prompt.setText(label(R.string.native_pin_verify_prompt));content.addView(prompt);
                mask=text(ui,24,0xfff7edda);mask.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);content.addView(mask);
                count=text(ui,14,0xffb6c4d9);content.addView(count);keypad=new android.widget.LinearLayout(ui);keypad.setOrientation(android.widget.LinearLayout.VERTICAL);keypad.setSaveEnabled(false);content.addView(keypad);
                int[][] digits={{1,2,3},{4,5,6},{7,8,9}};for(int[] row:digits){android.widget.LinearLayout line=new android.widget.LinearLayout(ui);
                    for(int digit:row){android.widget.Button key=button(ui,Integer.toString(digit),()->digit(digit));android.widget.LinearLayout.LayoutParams cell=new android.widget.LinearLayout.LayoutParams(0,dp(64),1);
                        cell.setMargins(dp(3),dp(3),dp(3),dp(3));line.addView(key,cell);}keypad.addView(line);}
                android.widget.LinearLayout bottom=new android.widget.LinearLayout(ui);for(android.widget.Button key:new android.widget.Button[]{button(ui,label(R.string.native_pin_delete),this::backspace),
                    button(ui,"0",()->digit(0)),button(ui,label(R.string.native_pin_cancel),this::cancel)}){android.widget.LinearLayout.LayoutParams cell=new android.widget.LinearLayout.LayoutParams(0,dp(64),1);
                    cell.setMargins(dp(3),dp(3),dp(3),dp(3));bottom.addView(key,cell);}keypad.addView(bottom);
                next=button(ui,label(R.string.native_pin_continue),this::continueInput);content.addView(next,new android.widget.LinearLayout.LayoutParams(-1,dp(64)));
                android.widget.ScrollView scroll=new android.widget.ScrollView(ui){@Override public boolean onFilterTouchEventForSecurity(android.view.MotionEvent event){
                    if(obscured(event)){uiEvent(thisInput()::cancel,true);return false;}return super.onFilterTouchEventForSecurity(event);}};
                scroll.setSaveEnabled(false);scroll.setFilterTouchesWhenObscured(true);scroll.addView(content);original.setContentView(scroll);require(original.getWindow()!=null);
                original.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);original.getWindow().getAttributes().token=activityToken;
                original.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
                original.setOnCancelListener(d->uiEvent(this::cancel,true));original.setOnDismissListener(d->uiEvent(this::dismissed,true));
                original.setOnKeyListener((d,key,event)->{if(key==android.view.KeyEvent.KEYCODE_BACK){if(event.getAction()==android.view.KeyEvent.ACTION_UP)uiEvent(this::cancel,true);return true;}return false;});
                synchronized(core){require(!request.cancelled);accepting=true;}render();original.show();shown=true;
                original.getWindow().setLayout(Math.min(dp(360),activity.getResources().getDisplayMetrics().widthPixels-dp(32)),Math.min(dp(700),activity.getResources().getDisplayMetrics().heightPixels-dp(64)));
                focusObserver=focused->{if(focused)everFocused=true;else if(everFocused&&shown)uiEvent(this::cancel,true);};
                original.getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(focusObserver);everFocused=original.getWindow().getDecorView().hasWindowFocus();
                long remaining=owned.deadlineUptimeMs-SystemClock.elapsedRealtime();require(remaining>0);timerArmed=true;require(main.postDelayed(deadlineTask,remaining));
            }catch(Exception failure){cancel();}
        }
        private void digit(int digit){requireMain();synchronized(core){if(!accepting||request.cancelled||length>=128||digit<0||digit>9)return;edit[length++]=(byte)(48+digit);}render();}
        private void backspace(){requireMain();synchronized(core){if(!accepting||request.cancelled||length==0)return;edit[--length]=0;}render();}
        private void render(){requireMain();int amount;synchronized(core){amount=length;}char[] bullets=new char[Math.min(amount,12)];Arrays.fill(bullets,'\u2022');
            mask.setText(new String(bullets));Arrays.fill(bullets,'\0');count.setText(localeContext().getString(R.string.native_pin_count,amount));next.setEnabled(amount>=1&&amount<=128);}
        private void continueInput(){requireMain();synchronized(core){if(!accepting||request.cancelled||length<1||length>128)return;
                entered=Arrays.copyOf(edit,length);Arrays.fill(edit,(byte)0);length=0;ready=true;accepting=false;core.notifyAll();}queueCleanup();}
        private void awaitUi() throws Exception {for(;;){synchronized(core){if(uiEnded&&pendingUi==0&&uiHandlers==0)return;core.wait(100);if(!request.cancelled)core.live(owned.ticket);}
                if(!request.cancelled){long now=SystemClock.elapsedRealtime();require(now>=owned.capturedUptimeMs);core.refuse(now<owned.deadlineUptimeMs,false);}}}
        private void joinActualUiAndCancel(){boolean interrupted=false;synchronized(core){while(!uiEnded||pendingUi!=0||uiHandlers!=0||cancelInFlight){
                    try{core.wait();}catch(InterruptedException ignored){interrupted=true;}}}if(interrupted)Thread.currentThread().interrupt();}
        private void detachObserver(){postUi(()->{if(timerArmed){main.removeCallbacks(deadlineTask);timerArmed=false;}if(observerRegistered){application.unregisterActivityLifecycleCallbacks(lifecycle);observerRegistered=false;}
                if(dialog!=null){dialog.setOnCancelListener(null);dialog.setOnDismissListener(null);}dialog=null;title=null;actionCaption=null;prompt=null;mask=null;count=null;next=null;keypad=null;});joinActualUiAndCancel();}
        private void deliverFailure(){synchronized(core){if(completionEntered)return;completionEntered=true;core.worker(owned.ticket);}
            try{completion.finished(null);}catch(Exception failure){core.failed(owned.ticket,failure,false);}finally{synchronized(core){core.settledWorker(owned.ticket);}}}
        /** The original abandoned transfer is retained for the missing private
         * caller's uncertain settlement; this method never ACKs or frees it. */
        private PinVerificationReply abandonedOriginalReply() throws Exception {synchronized(core){identity();require(finished&&!delivered&&reply!=null);return reply;}}
        private void work(){boolean claimed=false,captured=false;byte[] moved=null;PinVerificationInput raw=null;
            try{synchronized(core){identity();core.lease(owned);require(!request.cancelled&&owned.ticket.phase==PinVerificationPhase.ready&&owned.ticket.workers==0);core.worker(owned.ticket);claimed=true;}
                currentInput();postUi(this::present);awaitUi();synchronized(core){require(ready&&!request.cancelled&&entered!=null);}currentInput();captured=true;
            }catch(Exception failure){core.failed(owned.ticket,failure,false);cancel();}
            finally{queueCleanup();joinActualUiAndCancel();synchronized(core){if(claimed)core.settledWorker(owned.ticket);inputLeaseFinished=true;core.notifyAll();}}
            try{if(captured&&!request.cancelled){synchronized(core){identity();core.lease(owned);require(ready&&entered!=null);moved=entered;entered=null;}
                    raw=new PinVerificationInput(moved);moved=null;OwnedPinVerificationInput original=core.bindInput(owned,raw);raw=null;reply=core.verify(owned,original);
                    core.deliver(reply,originalReply->{synchronized(core){require(!completionEntered&&originalReply==reply);completionEntered=true;}
                        completion.finished(originalReply);});synchronized(core){delivered=true;}
                }else deliverFailure();
            }catch(Exception failure){cancel();if(reply!=null)try{core.sealUnknown(request.gate);}catch(Exception ignored){}
                if(!completionEntered)deliverFailure();}
            finally{PinVerifierMaterial.wipe(moved);if(raw!=null)raw.close();synchronized(core){Arrays.fill(edit,(byte)0);PinVerifierMaterial.wipe(entered);entered=null;}
                detachObserver();synchronized(core){finished=true;core.notifyAll();}}
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
    private static final class PinOwnerSigningMaterial {
        final java.security.PublicKey publicKey; final byte[] encoding; final java.security.Signature signature;
        final android.hardware.biometrics.BiometricPrompt.CryptoObject crypto;
        private PinOwnerSigningMaterial(java.security.PublicKey publicKey,java.security.Signature signature) throws Exception {
            this.publicKey=publicKey;this.signature=signature;byte[] value=publicKey.getEncoded(),owned=null;
            try{require(value!=null && value.length>0 && value.length<=512);owned=value.clone();
                android.hardware.biometrics.BiometricPrompt.CryptoObject original=new android.hardware.biometrics.BiometricPrompt.CryptoObject(signature);
                encoding=owned;crypto=original;owned=null;
            }finally{if(value!=null)Arrays.fill(value,(byte)0);if(owned!=null)Arrays.fill(owned,(byte)0);}
        }
    }

    /** Explicit LOCAL first-install v2 only. The unchanged v1 checkpoint remains
     * unavailable and its ProtectedEnvelope rejects this seed. No trusted boot,
     * cross-process clock, PIN, Parent Gate, recovery or child-mode admission. */
    private static final class LocalEmptySeedV2 implements AutoCloseable {
        private byte[] bytes; final String checksum, version, policyChecksum;
        private LocalEmptySeedV2(String version,String policyChecksum) throws Exception {
            require(ProtectedEnvelope.identifier(version) && ProtectedEnvelope.hash(policyChecksum));
            this.version=version;this.policyChecksum=policyChecksum;bytes=canonical(version,policyChecksum);checksum=digest(bytes);
        }
        private static byte[] canonical(String version,String policyChecksum) throws Exception {
            require(ProtectedEnvelope.identifier(version) && ProtectedEnvelope.hash(policyChecksum));
            String registry="{\"schemaVersion\":1,\"policyVersion\":\""+version+"\",\"activeProfileId\":null,\"profiles\":[]}";
            byte[] registryBytes=registry.getBytes(StandardCharsets.US_ASCII);
            try{return ("{\"schemaVersion\":2,\"revision\":1,\"mode\":\"adult\",\"selectionRevision\":1,\"profileRevision\":1,\"policyChecksum\":\""
                +policyChecksum+"\",\"registryChecksum\":\""+digest(registryBytes)+"\",\"registry\":"+registry
                +",\"pin\":null,\"clock\":{\"schemaVersion\":2,\"logicalMs\":0}}").getBytes(StandardCharsets.US_ASCII);
            }finally{Arrays.fill(registryBytes,(byte)0);}
        }
        private static LocalEmptySeedV2 decode(byte[] raw,String version,String policyChecksum) throws Exception {
            require(raw!=null && raw.length>0 && raw.length<=MAX_BYTES);LocalEmptySeedV2 value=new LocalEmptySeedV2(version,policyChecksum);
            try{require(MessageDigest.isEqual(raw,value.bytes));return value;}catch(Exception failure){value.close();throw failure;}
        }
        private synchronized byte[] copy() throws Exception {require(bytes!=null);return bytes.clone();}
        public synchronized void close(){if(bytes!=null){Arrays.fill(bytes,(byte)0);bytes=null;}}
    }

    private interface FirstInstallRecipient { void completed(FirstInstallReceipt receipt) throws Exception; }
    /** A local storage completion, never a Parent Gate/action permission. Closing
     * only wipes; only settlement of the ORIGINAL receipt drains this owner. */
    private static final class FirstInstallReceipt implements AutoCloseable {
        final NativeChildFirstInstall owner; final FirstInstallRequest request; final String checksum;
        private byte[] seed; private boolean disposed,settled;
        private FirstInstallReceipt(NativeChildFirstInstall owner,FirstInstallRequest request) throws Exception {
            this.owner=owner;this.request=request;checksum=request.seed.checksum;seed=request.seed.copy();
        }
        private synchronized byte[] copySeed() throws Exception {require(!disposed);return seed.clone();}
        private synchronized void wipe(){disposed=true;Arrays.fill(seed,(byte)0);}
        public void close(){boolean original;synchronized(owner){original=owner.active==request && request.receipt==this;}
            if(original)owner.cancel(request);wipe();}
    }
    private static final class FirstInstallRequest implements AutoCloseable {
        final NativeChildFirstInstall owner; final android.app.Activity activity; final android.os.IBinder windowToken;
        final String locale; final LocalEmptySeedV2 seed; final long beganUptimeMs,deadlineUptimeMs;
        private final byte[] nonce,payload; private byte[] keyEncoding,signature;
        private java.security.Signature originalSignature; private java.security.PublicKey publicKey;
        private android.hardware.biometrics.BiometricPrompt.CryptoObject originalCrypto;
        private android.os.CancellationSignal cancellation;
        private Thread worker; private FirstInstallReceipt receipt;
        private boolean started,cancelled,sealed,finished,disposed,detached,promptOutstanding,credentialReturned,knownRefusal;
        private boolean mutationStarted,permissionConsumed,deliveryEntered,deliveryCompleted,cancelIssued;
        private boolean retirementClaimed,retired;
        private int mainCalls,eventCalls,cancelCalls,readCalls,settleCalls,cleanupCalls; private Exception failure;
        private FirstInstallRequest(NativeChildFirstInstall owner,android.app.Activity activity,String locale,
            String version,String policyChecksum,long timeout,android.os.IBinder token) throws Exception {
            this.owner=owner;this.activity=activity;this.locale=locale;windowToken=token;
            long now=SystemClock.elapsedRealtime();require(now>=0 && now<=MAX_SAFE-timeout);beganUptimeMs=now;deadlineUptimeMs=now+timeout;
            seed=new LocalEmptySeedV2(version,policyChecksum);nonce=new byte[32];
            try{new java.security.SecureRandom().nextBytes(nonce);payload=NativeChildFirstInstall.operation(this);}
            catch(Exception failure){seed.close();Arrays.fill(nonce,(byte)0);throw failure;}
        }
        private void wipe(){seed.close();Arrays.fill(nonce,(byte)0);Arrays.fill(payload,(byte)0);
            if(signature!=null)Arrays.fill(signature,(byte)0);if(keyEncoding!=null)Arrays.fill(keyEncoding,(byte)0);if(receipt!=null)receipt.wipe();}
        public void close(){owner.cancel(this);synchronized(owner){disposed=true;owner.wipeIfIdle(this);}}
    }
    /** Constructor-owned explicit provisioning; never called by a read/error
     * fallback or App/plugin factory. Fixed signing key may survive a cancelled
     * pre-mutation setup and is re-used only after its exact policy is checked.
     * After the durable pending marker ANY failure leaves the installation
     * sealed; no deleteEntry, regeneration, reset or partial repair is offered.
     * Raw encrypted storage reuses the existing fixed v1 file/AAD identity;
     * schema2 does not become readable/admitted through ANY v1 codec/port. */
    private static final class NativeChildFirstInstall {
        private final PlanetChildVault vault; private volatile FirstInstallRequest active; private boolean reserving,sealed;
        private final android.os.Handler mainHandler=new android.os.Handler(android.os.Looper.getMainLooper());
        private NativeChildFirstInstall(PlanetChildVault vault) throws Exception {require(vault!=null);this.vault=vault;}
        private FirstInstallRequest request(android.app.Activity activity,String locale,String version,String policyChecksum,long timeout) throws Exception {
            synchronized(this){require(active==null && !reserving && !sealed);reserving=true;}
            try{require(android.os.Build.VERSION.SDK_INT>=30 && android.os.Looper.myLooper()==android.os.Looper.getMainLooper()
                && activity!=null && activity.getClass()==MainActivity.class && activity.getApplicationContext()==vault.context
                && !activity.isFinishing() && !activity.isDestroyed() && activity.hasWindowFocus()
                && ("ru".equals(locale)||"en".equals(locale)) && timeout>0 && timeout<=60000);
                android.os.IBinder token=activity.getWindow().getDecorView().getWindowToken();require(token!=null);
                FirstInstallRequest value=new FirstInstallRequest(this,activity,locale,version,policyChecksum,timeout,token);
                synchronized(this){require(reserving && active==null && !sealed);active=value;reserving=false;}
                try{attach(value);}catch(Exception failure){synchronized(this){value.cancelled=true;value.sealed=true;sealed=true;}
                    try{removeObservers(value);}catch(Exception unknown){synchronized(this){value.sealed=true;}}
                    synchronized(this){value.finished=true;wipeIfIdle(value);notifyAll();}throw failure;}
                return value;
            }finally{synchronized(this){reserving=false;}}
        }
        private static byte[] operation(FirstInstallRequest request) throws Exception {
            java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream(512);java.io.DataOutputStream out=new java.io.DataOutputStream(buffer);
            out.write("LP-LOCAL-FIRST-INSTALL\0v2\0".getBytes(StandardCharsets.US_ASCII));out.writeByte("ru".equals(request.locale)?1:2);
            for(String text:new String[]{request.owner.vault.vaultIdentity,request.seed.version,request.seed.policyChecksum,request.seed.checksum}) {
                byte[] raw=text.getBytes(StandardCharsets.US_ASCII);try{out.writeShort(raw.length);out.write(raw);}finally{Arrays.fill(raw,(byte)0);}}
            out.writeLong(request.beganUptimeMs);out.writeLong(request.deadlineUptimeMs);out.write(request.nonce);out.flush();return buffer.toByteArray();
        }
        private void own(FirstInstallRequest request) throws Exception {require(request!=null && request.owner==this && active==request);}
        private void wipeIfIdle(FirstInstallRequest request){if(request.finished && request.readCalls==0 && request.settleCalls==0
            && request.cleanupCalls==0 && request.eventCalls==0 && request.mainCalls==0 && request.cancelCalls==0
            && (request.cancelled || request.disposed || request.sealed))request.wipe();}
        private void live(FirstInstallRequest request) throws Exception {
            synchronized(this){own(request);long now=SystemClock.elapsedRealtime();if(sealed || request.cancelled || request.sealed || request.disposed || request.retirementClaimed || request.retired
                || now<request.beganUptimeMs || now>=request.deadlineUptimeMs)throw new PinKnownRefusal();
                byte[] actual=operation(request);try{require(MessageDigest.isEqual(actual,request.payload));}finally{Arrays.fill(actual,(byte)0);}}
        }
        private void main(FirstInstallRequest request,Runnable body) throws Exception {
            synchronized(this){own(request);require(!request.detached || request.readCalls>0 || request.cleanupCalls>0);request.mainCalls++;}
            boolean accepted;try{accepted=mainHandler.post(()->{try{body.run();}catch(Throwable error){synchronized(this){request.sealed=true;request.cancelled=true;
                    request.failure=error instanceof Exception?(Exception)error:new Unavailable();notifyAll();}}
                finally{synchronized(this){request.mainCalls--;wipeIfIdle(request);notifyAll();}}});}
            catch(RuntimeException failure){synchronized(this){request.mainCalls--;request.sealed=true;notifyAll();}throw failure;}
            if(!accepted) {
                synchronized(this){request.mainCalls--;request.sealed=true;notifyAll();}throw new Unavailable();}
        }
        private void host(FirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            for(;;){live(request);boolean[] valid={false},lost={false};
                main(request,()->{lost[0]=request.activity.isFinishing() || request.activity.isDestroyed()
                    || request.activity.getWindow().getDecorView().getWindowToken()!=request.windowToken;
                    valid[0]=!lost[0] && request.activity.hasWindowFocus();});
                synchronized(this){while(request.mainCalls!=0)wait();if(request.failure!=null)throw request.failure;live(request);
                    if(lost[0])throw new PinKnownRefusal();if(valid[0])return;
                    if(!request.credentialReturned)throw new PinKnownRefusal();wait(50);}}
        }
        private String signingAlias(FirstInstallRequest request) throws Exception {return PinNativeOwnerAuthority.alias(request.activity);}
        /** No child file is opened as a candidate seed. All known v1/v2 and
         * child-data footprints are denied, including orphan backup/new files. */
        private void empty(File directory,KeyStore keys) throws Exception {
            require(!keys.containsAlias(vault.vaultIdentity+".aes"));noChildData(keys);
            for(String name:new String[]{"full-record-v1","full-record-v1.bak","full-record-v1.new","first-install-v2","first-install-v2.bak","first-install-v2.new"})
                absent(new File(directory,name));
            String[] names=directory.list();require(names!=null);for(String name:names)require("transaction.lock".equals(name));
        }
        private void noChildData(KeyStore keys) throws Exception {
            require(!keys.containsAlias(vault.context.getPackageName()+".literary-planet-child-data-v1.aes"));
            File parent=vault.context.getNoBackupFilesDir().getCanonicalFile(),childData=new File(parent,"literary-planet-child-data-v1");
            require(childData.getAbsoluteFile().equals(childData.getCanonicalFile()));absent(childData);
        }
        private static void absent(File file) throws Exception {
            try{Os.lstat(file.getPath());throw new Unavailable();}
            catch(android.system.ErrnoException failure){require(failure.errno==OsConstants.ENOENT);}
        }
        private void prepareKey(FirstInstallRequest request) throws Exception {
            host(request);vault.locked(directory->{live(request);vault.unlocked();KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);empty(directory,keys);
                String alias=signingAlias(request);KeyguardManager guard=(KeyguardManager)vault.context.getSystemService(Context.KEYGUARD_SERVICE);
                require(guard!=null && guard.isDeviceSecure());if(!keys.containsAlias(alias)) {
                    live(request);java.security.KeyPairGenerator generator=java.security.KeyPairGenerator.getInstance("EC","AndroidKeyStore");
                    generator.initialize(new android.security.keystore.KeyGenParameterSpec.Builder(alias,android.security.keystore.KeyProperties.PURPOSE_SIGN)
                        .setAlgorithmParameterSpec(new java.security.spec.ECGenParameterSpec("secp256r1"))
                        .setDigests(android.security.keystore.KeyProperties.DIGEST_SHA256).setUserAuthenticationRequired(true)
                        .setUserAuthenticationParameters(0,android.security.keystore.KeyProperties.AUTH_DEVICE_CREDENTIAL).build());
                    generator.generateKeyPair();}
                live(request);PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,alias);
                boolean adopted=false;try{android.os.CancellationSignal cancellation=new android.os.CancellationSignal();
                    synchronized(this){live(request);request.publicKey=material.publicKey;request.keyEncoding=material.encoding;
                        request.originalSignature=material.signature;request.originalCrypto=material.crypto;request.cancellation=cancellation;adopted=true;}
                }finally{if(!adopted)Arrays.fill(material.encoding,(byte)0);}
                empty(directory,keys);return null;});host(request);live(request);
        }
        private void authenticate(FirstInstallRequest request,FirstInstallRecipient recipient) throws Exception {
            require(recipient!=null);synchronized(this){own(request);live(request);require(!request.started && !request.finished);
                request.started=true;request.worker=new Thread(()->run(request,recipient),"planet-child-first-install");
                try{request.worker.start();}catch(RuntimeException error){request.sealed=true;sealed=true;request.finished=true;request.wipe();notifyAll();throw error;}}
        }
        private void terminal(FirstInstallRequest request,android.hardware.biometrics.BiometricPrompt.AuthenticationResult result,Exception error) {
            synchronized(this){if(active!=request || request.detached || !request.promptOutstanding){request.sealed=true;request.cancelled=true;sealed=true;notifyAll();return;}
                request.promptOutstanding=false;request.credentialReturned=error==null && result!=null
                    && result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL
                    && result.getCryptoObject()==request.originalCrypto && result.getCryptoObject().getSignature()==request.originalSignature;
                if(!request.credentialReturned){request.cancelled=true;request.knownRefusal=true;}notifyAll();}
        }
        private void present(FirstInstallRequest request) throws Exception {
            main(request,()->{try{live(request);require(request.activity.hasWindowFocus()
                    && request.activity.getWindow().getDecorView().getWindowToken()==request.windowToken && observerRegistered && screenRegistered);
                android.hardware.biometrics.BiometricPrompt prompt=new android.hardware.biometrics.BiometricPrompt.Builder(request.activity)
                    .setTitle("ru".equals(request.locale)?"Подтвердите настройку родительского контроля":"Confirm parental controls setup")
                    .setSubtitle("ru".equals(request.locale)?"Подтвердите действие кодом блокировки устройства.":"Use your device screen lock to confirm this action.")
                    .setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build();
                synchronized(this){live(request);request.promptOutstanding=true;}
                prompt.authenticate(request.originalCrypto,request.cancellation,task->{try{main(request,task);}catch(Exception failure){synchronized(this){request.sealed=true;request.cancelled=true;notifyAll();}}},
                    new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback(){
                        @Override public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){terminal(request,result,null);}
                        @Override public void onAuthenticationError(int code,CharSequence text){terminal(request,null,new PinKnownRefusal());}
                    });
            }catch(Exception failure){synchronized(this){request.failure=failure;request.cancelled=true;request.knownRefusal=failure instanceof PinKnownRefusal;
                if(request.promptOutstanding)request.sealed=true;notifyAll();}cancel(request);}});
        }
        private boolean observerRegistered,screenRegistered;
        private void attach(FirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());synchronized(this){own(request);require(!observerRegistered && !screenRegistered);}
            request.activity.getApplication().registerActivityLifecycleCallbacks(lifecycle);observerRegistered=true;
            request.activity.registerReceiver(screenOff,new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF));screenRegistered=true;
            require(mainHandler.postDelayed(deadlineCheck,50));
        }
        private void removeObservers(FirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());mainHandler.removeCallbacks(deadlineCheck);
            if(screenRegistered){request.activity.unregisterReceiver(screenOff);screenRegistered=false;}
            if(observerRegistered){request.activity.getApplication().unregisterActivityLifecycleCallbacks(lifecycle);observerRegistered=false;}
            synchronized(this){request.detached=true;}
        }
        private void event(FirstInstallRequest request,Runnable body){synchronized(this){if(active!=request || request.detached)return;request.eventCalls++;}
            try{body.run();}finally{synchronized(this){request.eventCalls--;wipeIfIdle(request);notifyAll();}}}
        private final Runnable deadlineCheck=new Runnable(){public void run(){FirstInstallRequest request; synchronized(NativeChildFirstInstall.this){request=active;}
            if(request==null)return;event(request,()->{if(SystemClock.elapsedRealtime()>=request.deadlineUptimeMs)cancel(request);
                synchronized(NativeChildFirstInstall.this){if(!request.detached && !mainHandler.postDelayed(this,50)){request.sealed=true;request.cancelled=true;}}});}};
        private final android.content.BroadcastReceiver screenOff=new android.content.BroadcastReceiver(){
            public void onReceive(Context context,android.content.Intent intent){FirstInstallRequest request=active;if(request!=null)event(request,()->cancel(request));}
        };
        private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(android.app.Activity activity,android.os.Bundle state){}public void onActivityStarted(android.app.Activity activity){}
            public void onActivityResumed(android.app.Activity activity){}public void onActivitySaveInstanceState(android.app.Activity activity,android.os.Bundle state){}
            public void onActivityPaused(android.app.Activity activity){lost(activity);}public void onActivityStopped(android.app.Activity activity){lost(activity);}
            public void onActivityDestroyed(android.app.Activity activity){lost(activity);}
        };
        private void lost(android.app.Activity activity){FirstInstallRequest request=active;if(request!=null && request.activity==activity)event(request,()->cancel(request));}
        private void cancel(FirstInstallRequest request){android.os.CancellationSignal signal;synchronized(this){if(request==null || active!=request || request.owner!=this)return;
                request.cancelled=true;request.knownRefusal=true;signal=request.cancellation;if(request.finished){wipeIfIdle(request);notifyAll();return;}
                if(request.cancelIssued){notifyAll();return;}request.cancelIssued=true;request.cancelCalls++;}
            Thread worker=new Thread(()->{try{if(signal!=null)signal.cancel();}catch(Throwable failure){synchronized(this){request.sealed=true;}}
                finally{synchronized(this){request.cancelCalls--;wipeIfIdle(request);notifyAll();}}},"planet-child-first-install-cancel");
            try{worker.start();}catch(RuntimeException failure){synchronized(this){request.cancelCalls--;request.sealed=true;notifyAll();}}}
        private void waitPrompt(FirstInstallRequest request) throws Exception {
            for(;;){boolean expire;synchronized(this){if(!request.promptOutstanding && request.mainCalls==0)break;
                expire=!request.cancelled && SystemClock.elapsedRealtime()>=request.deadlineUptimeMs;if(!expire)wait(50);}if(expire)cancel(request);}
            synchronized(this){if(request.failure!=null)throw request.failure;live(request);require(request.credentialReturned);}
        }
        private void verify(FirstInstallRequest request) throws Exception {
            live(request);require(request.signature!=null && request.signature.length>=8 && request.signature.length<=80 && request.publicKey!=null);
            byte[] encoded=request.publicKey.getEncoded();try{require(MessageDigest.isEqual(encoded,request.keyEncoding));}finally{Arrays.fill(encoded,(byte)0);}
            java.security.Signature check=java.security.Signature.getInstance("SHA256withECDSA");check.initVerify(request.publicKey);check.update(request.payload);require(check.verify(request.signature));live(request);
        }
        private static byte[] marker(FirstInstallRequest request,boolean complete) throws Exception {
            byte[] value=new byte[1+request.payload.length];value[0]=(byte)(complete?2:1);System.arraycopy(request.payload,0,value,1,request.payload.length);return value;
        }
        private static void syncDirectory(File directory) throws Exception {
            FileDescriptor descriptor=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
            try{require(OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode));Os.fsync(descriptor);}finally{Os.close(descriptor);}
        }
        private static void markerReadback(File file,byte[] expected) throws Exception {
            require(file.getAbsoluteFile().equals(file.getCanonicalFile()));FileDescriptor descriptor=Os.open(file.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
            byte[] actual=new byte[expected.length];try(FileInputStream input=new FileInputStream(descriptor)){StructStat opened=Os.fstat(descriptor),named=Os.lstat(file.getPath());
                require(OsConstants.S_ISREG(opened.st_mode) && opened.st_size==expected.length && opened.st_ino==named.st_ino && opened.st_dev==named.st_dev);int offset=0;
                while(offset<actual.length){int count=input.read(actual,offset,actual.length-offset);require(count>0);offset+=count;}require(input.read()==-1);require(MessageDigest.isEqual(actual,expected));
            }finally{Arrays.fill(actual,(byte)0);}
        }
        private void pending(File directory,FirstInstallRequest request) throws Exception {
            File file=new File(directory,"first-install-v2");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));byte[] value=marker(request,false);
            try{FileDescriptor descriptor=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
                synchronized(this){request.mutationStarted=true;}try(FileOutputStream output=new FileOutputStream(descriptor)){output.write(value);output.getFD().sync();}
                syncDirectory(directory);markerReadback(file,value);
            }finally{Arrays.fill(value,(byte)0);}
        }
        private void aes(KeyStore keys,FirstInstallRequest request) throws Exception {
            live(request);String alias=vault.vaultIdentity+".aes";require(!keys.containsAlias(alias));
            javax.crypto.KeyGenerator generator=javax.crypto.KeyGenerator.getInstance("AES","AndroidKeyStore");
            generator.init(new android.security.keystore.KeyGenParameterSpec.Builder(alias,android.security.keystore.KeyProperties.PURPOSE_ENCRYPT|android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(256).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true)
                .setUnlockedDeviceRequired(true).build());generator.generateKey();live(request);
            java.security.Key key=keys.getKey(alias,null);require(key instanceof SecretKey);
            android.security.keystore.KeyInfo info=(android.security.keystore.KeyInfo)javax.crypto.SecretKeyFactory.getInstance("AES","AndroidKeyStore").getKeySpec((SecretKey)key,android.security.keystore.KeyInfo.class);
            require(alias.equals(info.getKeystoreAlias()) && info.getKeySize()==256 && info.getOrigin()==android.security.keystore.KeyProperties.ORIGIN_GENERATED
                && info.getPurposes()==(android.security.keystore.KeyProperties.PURPOSE_ENCRYPT|android.security.keystore.KeyProperties.PURPOSE_DECRYPT)
                && info.isInsideSecureHardware() && info.getBlockModes().length==1 && android.security.keystore.KeyProperties.BLOCK_MODE_GCM.equals(info.getBlockModes()[0])
                && info.getEncryptionPaddings().length==1 && android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE.equals(info.getEncryptionPaddings()[0]));
        }
        /** Every main/recipient/cancel wait is OUTSIDE this IO lock. The lock
         * contains only local nonblocking identity/deadline checks and actual
         * native key/file operations; their uncertain results seal permanently. */
        private void commit(FirstInstallRequest request) throws Exception {
            host(request);verify(request);vault.locked(directory->{live(request);vault.unlocked();KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);
                empty(directory,keys);PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,signingAlias(request));
                try{require(MessageDigest.isEqual(material.encoding,request.keyEncoding));}finally{Arrays.fill(material.encoding,(byte)0);}
                verify(request);pending(directory,request);live(request);aes(keys,request);byte[] seed=request.seed.copy();
                try{vault.writeExact(directory,seed,()->live(request));byte[] actual=vault.readExact(directory);
                    try{require(MessageDigest.isEqual(actual,seed));try(LocalEmptySeedV2 parsed=LocalEmptySeedV2.decode(actual,request.seed.version,request.seed.policyChecksum)){
                        require(parsed.checksum.equals(request.seed.checksum));}}
                    finally{Arrays.fill(actual,(byte)0);}
                    live(request);verify(request);byte[] complete=marker(request,true);try{AtomicFile marker=new AtomicFile(new File(directory,"first-install-v2"));FileOutputStream stream=null;
                        try{stream=marker.startWrite();stream.write(complete);live(request);stream.getFD().sync();live(request);marker.finishWrite(stream);stream=null;}
                        finally{if(stream!=null)marker.failWrite(stream);}syncDirectory(directory);markerReadback(marker.getBaseFile(),complete);noChildData(keys);live(request);
                        synchronized(this){own(request);require(!request.permissionConsumed);request.permissionConsumed=true;}
                    }finally{Arrays.fill(complete,(byte)0);}
                }finally{Arrays.fill(seed,(byte)0);}return null;});host(request);live(request);
        }
        private void detach(FirstInstallRequest request) throws Exception {
            main(request,()->{try{removeObservers(request);}catch(Exception failure){synchronized(this){request.sealed=true;request.failure=failure;notifyAll();}}});
            synchronized(this){while(request.mainCalls!=0 || request.eventCalls!=0 || request.cancelCalls!=0)wait();if(request.failure!=null)throw request.failure;}
        }
        private void run(FirstInstallRequest request,FirstInstallRecipient recipient) {
            try{prepareKey(request);present(request);waitPrompt(request);host(request);live(request);request.originalSignature.update(request.payload);
                request.signature=request.originalSignature.sign();verify(request);host(request);commit(request);
                synchronized(this){live(request);require(request.permissionConsumed);request.receipt=new FirstInstallReceipt(this,request);request.deliveryEntered=true;}
                recipient.completed(request.receipt);host(request);live(request);synchronized(this){request.deliveryCompleted=true;}
            }catch(Throwable error){synchronized(this){request.cancelled=true;request.knownRefusal=error instanceof PinKnownRefusal;
                    if(request.mutationStarted || request.deliveryEntered || !request.knownRefusal)request.sealed=true;request.failure=error instanceof Exception?(Exception)error:new Unavailable();}
                cancel(request);boolean failureDelivery;synchronized(this){failureDelivery=!request.deliveryEntered;request.deliveryEntered=true;}
                if(failureDelivery)try{recipient.completed(null);}catch(Throwable ignored){synchronized(this){request.sealed=true;}}}
            finally{try{for(;;){synchronized(this){if(!request.promptOutstanding && request.mainCalls==0 && request.cancelCalls==0 && request.eventCalls==0)break;wait(50);}}
                    // Successful or uncertain original receipt keeps the native
                    // lifecycle/deadline latch until explicit actual retirement.
                    if(request.receipt==null)detach(request);}
                catch(Exception error){synchronized(this){request.sealed=true;request.cancelled=true;}}
                synchronized(this){if(SystemClock.elapsedRealtime()>=request.deadlineUptimeMs)request.cancelled=true;
                    request.finished=true;if(request.sealed || request.mutationStarted && !request.deliveryCompleted){sealed=true;request.sealed=true;}
                    wipeIfIdle(request);notifyAll();}}
        }
        private void settle(FirstInstallReceipt receipt,PinReplyDelivery delivery) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());FirstInstallRequest request;
            synchronized(this){require(receipt!=null && active!=null && receipt==active.receipt && receipt.owner==this && receipt.request==active
                && !receipt.settled && delivery!=null && active.finished && active.mainCalls==0 && active.eventCalls==0 && active.cancelCalls==0
                && active.readCalls==0 && active.settleCalls==0 && active.cleanupCalls==0 && !active.retirementClaimed && !active.retired);request=active;request.settleCalls++;}
            try{if(delivery==PinReplyDelivery.known){host(request);live(request);}
                synchronized(this){own(request);require(!receipt.settled);
                    require(delivery==PinReplyDelivery.uncertain || !receipt.disposed && request.deliveryCompleted && !request.cancelled
                        && !request.sealed && request.permissionConsumed && request.mainCalls==0 && request.eventCalls==0 && request.cancelCalls==0);
                    if(delivery==PinReplyDelivery.known)live(request);receipt.settled=true;receipt.wipe();
                    if(delivery==PinReplyDelivery.uncertain){sealed=true;request.sealed=true;request.cancelled=true;}}
            }finally{synchronized(this){request.settleCalls--;wipeIfIdle(request);notifyAll();}}
        }
        /** Original setup readback only, not an authenticated general record
         * port. In particular it does not call v1 readCandidate/bootSample. */
        private byte[] readInstalledSeed(FirstInstallReceipt receipt) throws Exception {
            FirstInstallRequest request;synchronized(this){require(receipt!=null && active!=null && receipt==active.receipt && receipt.owner==this
                && receipt.request==active && !receipt.disposed && active.finished && active.deliveryCompleted && active.permissionConsumed && active.readCalls==0);request=active;live(request);request.readCalls++;}
            byte[] result=null;try{host(request);result=vault.locked(directory->{live(request);byte[] raw=vault.readExact(directory);
                try{try(LocalEmptySeedV2 decoded=LocalEmptySeedV2.decode(raw,request.seed.version,request.seed.policyChecksum)){
                        require(decoded.checksum.equals(request.seed.checksum));}live(request);byte[] owned=raw;raw=null;return owned;
                }finally{if(raw!=null)Arrays.fill(raw,(byte)0);}});
                host(request);live(request);byte[] owned=result;result=null;return owned;
            }finally{if(result!=null)Arrays.fill(result,(byte)0);synchronized(this){request.readCalls--;wipeIfIdle(request);notifyAll();}}
        }
        /** Explicit pre-mutation retry only after genuine prompt cancellation,
         * callback/worker joins and known failure delivery. Storage is inspected
         * again on the next explicit request; this never repairs/reset state. */
        private void retire(FirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());synchronized(this){own(request);require(Thread.currentThread()!=request.worker
                    && !request.retirementClaimed && !request.retired && (request.receipt==null || request.receipt.settled));request.retirementClaimed=true;}cancel(request);
            synchronized(this){if(!request.started){request.finished=true;request.knownRefusal=true;}
                while(!request.finished || request.mainCalls!=0 || request.eventCalls!=0 || request.cancelCalls!=0 || request.readCalls!=0 || request.settleCalls!=0)wait();
                require(request.receipt==null || request.receipt.settled);request.cleanupCalls++;}
            try{if(!request.detached)detach(request);}catch(Exception failure){synchronized(this){request.sealed=true;sealed=true;}throw failure;}
            finally{synchronized(this){request.cleanupCalls--;wipeIfIdle(request);notifyAll();}}
            synchronized(this){own(request);require(request.retirementClaimed && !request.retired && request.detached && request.mainCalls==0 && request.eventCalls==0 && request.cancelCalls==0
                    && request.readCalls==0 && request.settleCalls==0 && request.cleanupCalls==0);request.wipe();
                request.retired=true;
                if(!request.mutationStarted && !request.sealed && request.knownRefusal){active=null;}
                else{sealed=true;request.sealed=true;}notifyAll();}
        }
    }

}

