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


    /** LOCAL v2 structural bytes and fixed encrypted snapshot publication only.
     * No v1 clock is invented, and no codec/plan/storage receipt grants PIN,
     * OS-owner, recovery, time provenance or Parent Gate permission. The private
     * v2 owner/input/KDF adapter is connected below; its factory remains null. */
    private static final class LocalSnapshotV2Policy {
        final String version, checksum; final long maximumIterations; private final long[] delays;
        private LocalSnapshotV2Policy(String version,String checksum,long maximum,long[] delays) throws Exception {
            require(ProtectedEnvelope.identifier(version)&&ProtectedEnvelope.hash(checksum)&&maximum>=600000
                &&maximum<=0xffffffffL&&delays!=null&&delays.length>0&&delays.length<=64);
            long[] owned=delays.clone();for(int i=0;i<owned.length;i++)require(owned[i]>0&&owned[i]<=MAX_SAFE&&(i==0||owned[i]>owned[i-1]));
            this.version=version;this.checksum=checksum;maximumIterations=maximum;this.delays=owned;
        }
        private long delay(long count) throws Exception {require(count>=0&&count<=MAX_SAFE);return count==0?0:delays[(int)Math.min(count-1,delays.length-1)];}
    }
    private static final class LocalSnapshotV2 implements AutoCloseable {
        private static final int JOURNAL_MAX=4096;
        final LocalSnapshotV2Policy policy; final String checksum,protectedChecksum,credentialId,pendingAttemptId;
        final long revision,pinRevision,count,blockedUntilMs,lastObservedMs,clockMs,journalRevision,savedCooldownMs;
        private final byte[] canonical; private final int protectedStart,protectedEnd,journalStart,journalEnd,revisionStart,revisionEnd,pinStart,pinEnd;
        private boolean closed;
        private LocalSnapshotV2(LocalSnapshotV2Policy policy,byte[] owned,String protectedChecksum,ProtectedEnvelope.Pin pin,
            long revision,long clock,long journalRevision,long delay,int[] offsets) throws Exception {
            this.policy=policy;canonical=owned;checksum=digest(owned);this.protectedChecksum=protectedChecksum;
            this.revision=revision;pinRevision=pin.revision;count=pin.count;blockedUntilMs=pin.blockedUntilMs;
            lastObservedMs=pin.lastObservedMs;clockMs=clock;this.journalRevision=journalRevision;savedCooldownMs=delay;
            credentialId=pin.credentialId;pendingAttemptId=pin.pendingAttemptId;
            protectedStart=offsets[0];protectedEnd=offsets[1];journalStart=offsets[2];journalEnd=offsets[3];
            revisionStart=offsets[4];revisionEnd=offsets[5];pinStart=offsets[6];pinEnd=offsets[7];
        }
        /** Reuses only the existing strict schema-1 registry/PIN lexer. Root,
         * clock and journal are independently schema2; no fake v1 boot fields. */
        private static LocalSnapshotV2 decode(byte[] input,LocalSnapshotV2Policy policy) throws Exception {
            require(policy!=null&&input!=null&&input.length>0&&input.length<=MAX_BYTES);byte[] owned=input.clone();
            byte[] registryBytes=null,protectedBytes=null;
            try{String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(owned)).toString();
                ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(text);
                p.field("schemaVersion",true);p.number(2,2);p.field("protectedRecord",false);int ps=p.byteOffset(p.index);
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);int rs=p.byteOffset(p.index);
                long revision=p.number(1,MAX_SAFE);int re=p.byteOffset(p.index);
                p.field("mode",false);String mode=p.string();require(mode.equals("adult")||mode.equals("child"));
                p.field("selectionRevision",false);p.number(1,MAX_SAFE);p.field("profileRevision",false);p.number(1,MAX_SAFE);
                p.field("policyChecksum",false);require(p.string().equals(policy.checksum));
                p.field("registryChecksum",false);String registryChecksum=p.string();require(ProtectedEnvelope.hash(registryChecksum));
                p.field("registry",false);int registryStart=p.byteOffset(p.index);String active=ProtectedEnvelope.registry(p,policy.version);
                int registryEnd=p.byteOffset(p.index);registryBytes=Arrays.copyOfRange(owned,registryStart,registryEnd);
                require(digest(registryBytes).equals(registryChecksum)&&(!mode.equals("child")||active!=null));
                p.field("pin",false);int pinStart=p.byteOffset(p.index);ProtectedEnvelope.Pin pin=ProtectedEnvelope.pin(p,policy.version,policy.maximumIterations);
                int pinEnd=p.byteOffset(p.index);p.field("clock",false);p.field("schemaVersion",true);p.number(2,2);
                p.field("logicalMs",false);long clock=p.number(0,MAX_SAFE);p.token("}");p.token("}");int pe=p.byteOffset(p.index);
                require(clock<=pin.lastObservedMs);protectedBytes=Arrays.copyOfRange(owned,ps,pe);String protectedChecksum=digest(protectedBytes);
                p.field("restartJournal",false);int js=p.byteOffset(p.index);
                p.field("schemaVersion",true);p.number(2,2);p.field("policyVersion",false);require(p.string().equals(policy.version));
                p.field("policyChecksum",false);require(p.string().equals(policy.checksum));p.field("revision",false);long jr=p.number(1,MAX_SAFE);
                p.field("protected",false);p.field("checksum",true);require(p.string().equals(protectedChecksum));
                p.field("revision",false);require(p.number(1,MAX_SAFE)==revision);p.field("pinRevision",false);require(p.number(1,MAX_SAFE)==pin.revision);
                p.field("credentialId",false);require(p.string().equals(pin.credentialId));p.token("}");
                p.field("attempts",false);p.field("count",true);require(p.number(0,MAX_SAFE)==pin.count);
                p.field("pendingAttemptId",false);require(java.util.Objects.equals(p.nullableString(),pin.pendingAttemptId));
                p.field("savedCooldownMs",false);long delay=p.number(0,MAX_SAFE);require(delay==policy.delay(pin.count));p.token("}");
                p.field("anchor",false);p.field("logicalMs",true);require(p.number(0,MAX_SAFE)==pin.lastObservedMs);p.token("}");p.token("}");
                int je=p.byteOffset(p.index);p.token("}");require(p.index==text.length()&&je-js<=JOURNAL_MAX&&delay<=MAX_SAFE-pin.lastObservedMs
                    &&(pin.count==0?pin.pendingAttemptId==null&&pin.blockedUntilMs==0:pin.blockedUntilMs==pin.lastObservedMs+delay));
                LocalSnapshotV2 result=new LocalSnapshotV2(policy,owned,protectedChecksum,pin,revision,clock,jr,delay,
                    new int[]{ps,pe,js,je,rs,re,pinStart,pinEnd});owned=null;return result;
            }finally{wipe(owned);wipe(registryBytes);wipe(protectedBytes);}
        }
        private static void wipe(byte[] value){if(value!=null)Arrays.fill(value,(byte)0);}
        private synchronized void live() throws Exception {require(!closed&&digest(canonical).equals(checksum));}
        private synchronized byte[] copy() throws Exception {live();return canonical.clone();}
        public synchronized void close(){closed=true;wipe(canonical);}
        private static long increment(long value) throws Exception {require(value>=0&&value<MAX_SAFE);return value+1;}
        private static long add(long at,long delay) throws Exception {require(at>=0&&at<=MAX_SAFE&&delay>=0&&delay<=MAX_SAFE-at);return at+delay;}
        private static String quoted(String value){return ProtectedEnvelope.Cursor.quote(value);}
        private static byte[] wire(byte[] protectedBytes,LocalSnapshotV2Policy policy,long jr,long root,long pin,String credential,
            long count,String pending,long delay,long at) throws Exception {
            require(protectedBytes!=null&&protectedBytes.length>0&&protectedBytes.length<=MAX_BYTES&&jr>0&&jr<=MAX_SAFE
                &&root>0&&root<=MAX_SAFE&&pin>0&&pin<=MAX_SAFE&&ProtectedEnvelope.hash(credential)
                &&(pending==null||ProtectedEnvelope.hash(pending))&&count>=0&&count<=MAX_SAFE&&delay==policy.delay(count));add(at,delay);
            byte[] journal=("{\"schemaVersion\":2,\"policyVersion\":"+quoted(policy.version)+",\"policyChecksum\":"+quoted(policy.checksum)
                +",\"revision\":"+jr+",\"protected\":{\"checksum\":"+quoted(digest(protectedBytes))+",\"revision\":"+root
                +",\"pinRevision\":"+pin+",\"credentialId\":"+quoted(credential)+"},\"attempts\":{\"count\":"+count
                +",\"pendingAttemptId\":"+(pending==null?"null":quoted(pending))+",\"savedCooldownMs\":"+delay
                +"},\"anchor\":{\"logicalMs\":"+at+"}}").getBytes(StandardCharsets.UTF_8);
            byte[] prefix="{\"schemaVersion\":2,\"protectedRecord\":".getBytes(StandardCharsets.US_ASCII);
            byte[] middle=",\"restartJournal\":".getBytes(StandardCharsets.US_ASCII);byte[] result=null;
            try{require(journal.length<=JOURNAL_MAX&&prefix.length+protectedBytes.length+middle.length+journal.length+1<=MAX_BYTES);
                result=new byte[prefix.length+protectedBytes.length+middle.length+journal.length+1];int position=0;
                for(byte[] part:new byte[][]{prefix,protectedBytes,middle,journal}){System.arraycopy(part,0,result,position,part.length);position+=part.length;}
                result[position]='}';try(LocalSnapshotV2 checked=decode(result,policy)){require(checked.revision==root&&checked.pinRevision==pin);}
                byte[] out=result;result=null;return out;
            }finally{wipe(journal);wipe(prefix);wipe(middle);wipe(result);}
        }
        /** Data-only enrollment check: same exact empty seed/non-PIN/clock;
         * supplied logical is comparison data here, not an eligibility signal. */
        private static void validateEnrollment(byte[] seed,LocalSnapshotV2 after,long logical) throws Exception {
            require(after!=null&&logical>=0&&logical<=MAX_SAFE);byte[] old=null,next=null;
            try(LocalEmptySeedV2 before=LocalEmptySeedV2.decode(seed,after.policy.version,after.policy.checksum)){
                old=before.copy();next=after.copy();ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(old,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);int rs=p.byteOffset(p.index);p.number(1,1);int re=p.byteOffset(p.index);
                p.field("mode",false);p.string();p.field("selectionRevision",false);p.number(1,1);p.field("profileRevision",false);p.number(1,1);
                p.field("policyChecksum",false);p.string();p.field("registryChecksum",false);p.string();p.field("registry",false);ProtectedEnvelope.registry(p,after.policy.version);
                p.field("pin",false);int pinStart=p.byteOffset(p.index);p.token("null");int pinEnd=p.byteOffset(p.index);
                require(after.revision==2&&after.pinRevision==1&&after.journalRevision==1&&after.count==0&&after.pendingAttemptId==null
                    &&after.blockedUntilMs==0&&after.lastObservedMs==logical&&after.clockMs==0
                    &&ProtectedEnvelope.equalRange(old,0,rs,next,after.protectedStart,after.revisionStart)
                    &&ProtectedEnvelope.equalRange(old,re,pinStart,next,after.revisionEnd,after.pinStart)
                    &&ProtectedEnvelope.equalRange(old,pinEnd,old.length,next,after.pinEnd,after.protectedEnd));
            }finally{wipe(old);wipe(next);}
        }
        /** Reanchor only increments J. It grants zero time credit: P and the
         * anchor/saved debt remain exact; the native session starts a NEW clock. */
        private static byte[] reanchor(LocalSnapshotV2 before) throws Exception {
            byte[] old=before.copy(),record=null;try{record=Arrays.copyOfRange(old,before.protectedStart,before.protectedEnd);
                return wire(record,before.policy,increment(before.journalRevision),before.revision,before.pinRevision,before.credentialId,
                    before.count,before.pendingAttemptId,before.savedCooldownMs,before.lastObservedMs);
            }finally{wipe(old);wipe(record);}
        }
        /** Exact PIN-only replacement; all verifier/non-PIN/clock bytes persist. */
        private static byte[] attempt(LocalSnapshotV2 before,long count,String pending,long logical) throws Exception {
            require(logical>=before.lastObservedMs&&logical>=before.clockMs&&count>=0&&count<=MAX_SAFE
                &&(pending==null||ProtectedEnvelope.hash(pending)));byte[] old=before.copy(),record=null;
            try{String pinText=new String(old,before.pinStart,before.pinEnd-before.pinStart,StandardCharsets.UTF_8);
                ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(pinText);p.field("schemaVersion",true);p.number(1,1);
                p.field("policyVersion",false);p.string();p.field("revision",false);int prs=p.byteOffset(p.index);p.number(1,MAX_SAFE);int pre=p.byteOffset(p.index);
                p.field("credentialId",false);p.string();p.field("verifier",false);p.field("algorithm",true);p.string();p.field("iterations",false);p.number(600000,before.policy.maximumIterations);
                p.field("saltHex",false);p.string();p.field("hashHex",false);p.string();p.token("}");p.field("attempts",false);int aps=p.byteOffset(p.index);
                long delay=before.policy.delay(count),root=increment(before.revision),pin=increment(before.pinRevision);
                String attempts="{\"count\":"+count+",\"blockedUntilMs\":"+(count==0?0:add(logical,delay))+",\"lastObservedMs\":"+logical
                    +",\"pendingAttemptId\":"+(pending==null?"null":quoted(pending))+"}}";
                String rebuiltPin=pinText.substring(0,prs)+pin+pinText.substring(pre,aps)+attempts;
                byte[] newPin=rebuiltPin.getBytes(StandardCharsets.UTF_8),rootNumber=Long.toString(root).getBytes(StandardCharsets.US_ASCII);
                try{int length=before.revisionStart-before.protectedStart+rootNumber.length+before.pinStart-before.revisionEnd+newPin.length+before.protectedEnd-before.pinEnd;
                    require(length<=MAX_BYTES);record=new byte[length];int pos=0;
                    int[] starts={before.protectedStart,before.revisionEnd,before.pinEnd};int[] ends={before.revisionStart,before.pinStart,before.protectedEnd};
                    for(int i=0;i<3;i++){int n=ends[i]-starts[i];System.arraycopy(old,starts[i],record,pos,n);pos+=n;
                        if(i<2){byte[] insert=i==0?rootNumber:newPin;System.arraycopy(insert,0,record,pos,insert.length);pos+=insert.length;}}
                    return wire(record,before.policy,increment(before.journalRevision),root,pin,before.credentialId,count,pending,delay,logical);
                }finally{wipe(newPin);wipe(rootNumber);}
            }finally{wipe(old);wipe(record);}
        }
        private static byte[] charge(LocalSnapshotV2 before,String originalAttemptId,long logical) throws Exception {
            require(ProtectedEnvelope.hash(originalAttemptId)&&logical>=before.blockedUntilMs);
            return attempt(before,increment(before.count),originalAttemptId,logical);
        }
        /** A validator is mathematical data, not a finalize permission. The
         * writer finalize entry separately requires its genuine v2 native
         * KDF/comparison bound to the ORIGINAL charged reservation. */
        private static void validateFinalization(LocalSnapshotV2 charged,LocalSnapshotV2 after) throws Exception {
            require(charged!=null&&after!=null&&charged.pendingAttemptId!=null&&after.pendingAttemptId==null
                &&after.lastObservedMs>=charged.lastObservedMs&&(after.count==0||after.count==charged.count));
            byte[] expected=attempt(charged,after.count,null,after.lastObservedMs),actual=null;
            try{actual=after.copy();require(MessageDigest.isEqual(expected,actual));}finally{wipe(expected);wipe(actual);}
        }
    }

    /** Storage-only original receipt. A known ACK means exact raw encrypted
     * record/readback, never PIN correctness, OS-owner or Gate admission. */
    private static final class LocalV2StorageReceipt implements AutoCloseable {
        final LocalV2Writer owner;final LocalV2Request request;final String checksum;private final byte[] bytes;private boolean closed;
        private LocalV2StorageReceipt(LocalV2Writer owner,LocalV2Request request,byte[] owned) throws Exception {
            this.owner=owner;this.request=request;bytes=owned;checksum=digest(owned);
        }
        private byte[] copy() throws Exception {synchronized(owner){owner.own(request);require(!closed&&request.receipt==this
            &&!request.cancelled&&!request.sealed&&!request.retiring&&request.workers==0&&request.settleCalls==0);
            owner.live(request);require(digest(bytes).equals(checksum));return bytes.clone();}}
        private void wipe(){closed=true;LocalSnapshotV2.wipe(bytes);}
        public void close(){synchronized(owner){wipe();}}
    }
    private static final class LocalV2ChargedReservation implements AutoCloseable {
        final LocalV2Writer owner;final LocalV2Request request;final String attemptId,checksum;private final byte[] charged;private boolean closed;
        private LocalV2ChargedReservation(LocalV2Writer owner,LocalV2Request request,String id,byte[] owned) throws Exception {
            this.owner=owner;this.request=request;attemptId=id;charged=owned;checksum=digest(owned);
        }
        private void wipe(){closed=true;LocalSnapshotV2.wipe(charged);}
        public void close(){synchronized(owner){wipe();}}
    }
    /** Process-local elapsed credit only. No serialized uptime/process token,
     * wall clock, reboot credit, nonrollback, input or Gate authority. The
     * production writer selects its one native fixed namespace and real clock;
     * isolated synthetic instances below are usable only as mechanical tests. */
    private interface LocalV2ElapsedClock { long now() throws Exception; }
    private enum LocalV2ClockAction { reanchor, enroll, charge, finalize, profile }
    private static final class LocalV2ClockLease {
        final LocalV2ProcessClock owner;final Object original;final long began,deadline;
        private boolean closed;private LocalV2ClockSample sample;
        private LocalV2ClockLease(LocalV2ProcessClock owner,Object original,long at,long deadline){
            this.owner=owner;this.original=original;began=at;this.deadline=deadline;}
    }
    private static final class LocalV2ClockSample {
        final LocalV2ProcessClock owner;final LocalV2ClockLease lease;final String checksum;
        final long continuousMs,logicalMs;private boolean consumed;
        private LocalV2ClockSample(LocalV2ProcessClock owner,LocalV2ClockLease lease,String sum,long at,long logical){
            this.owner=owner;this.lease=lease;checksum=sum;continuousMs=at;logicalMs=logical;}
    }
    private static final class LocalV2ClockBinding {
        final byte[] bytes;final String checksum,credentialId,protectedChecksum;final boolean seed;
        final long revision,pinRevision,journalRevision,count,blockedUntilMs,lastObservedMs;
        private LocalV2ClockBinding(byte[] raw,LocalSnapshotV2Policy policy,boolean seed) throws Exception {
            this.seed=seed;byte[] owned=raw.clone();boolean adopted=false;
            try{checksum=digest(owned);
                if(seed){try(LocalEmptySeedV2 checked=LocalEmptySeedV2.decode(owned,policy.version,policy.checksum)){}
                    credentialId=null;protectedChecksum=null;revision=1;pinRevision=0;journalRevision=0;count=0;blockedUntilMs=0;lastObservedMs=0;
                }else try(LocalSnapshotV2 checked=LocalSnapshotV2.decode(owned,policy)){
                    credentialId=checked.credentialId;protectedChecksum=checked.protectedChecksum;revision=checked.revision;pinRevision=checked.pinRevision;
                    journalRevision=checked.journalRevision;count=checked.count;blockedUntilMs=checked.blockedUntilMs;lastObservedMs=checked.lastObservedMs;}
                bytes=owned;adopted=true;
            }finally{if(!adopted)LocalSnapshotV2.wipe(owned);}
        }
        private boolean matches(byte[] raw) throws Exception {return raw!=null&&checksum.equals(digest(bytes))
            &&checksum.equals(digest(raw))&&MessageDigest.isEqual(bytes,raw);}
        private void wipe(){LocalSnapshotV2.wipe(bytes);}
    }
    private static final class LocalV2ProcessClock {
        final String storageIdentity;private final LocalSnapshotV2Policy policy;private final LocalV2ElapsedClock clock;
        private LocalV2ClockLease active;private LocalV2ClockBinding known,pending;
        private final java.util.HashSet<String> pinUsedIds=new java.util.HashSet<>();
        private final java.util.IdentityHashMap<Object,Boolean> pinUsedChallenges=new java.util.IdentityHashMap<>();
        private synchronized void claimPin(LocalV2ClockLease lease,String id,Object challenge) throws Exception {
            current(lease);if(!ProtectedEnvelope.hash(id)||challenge==null||pinUsedIds.size()>=2048||pinUsedIds.contains(id)||pinUsedChallenges.containsKey(challenge))throw new PinKnownRefusal();
            pinUsedIds.add(id);pinUsedChallenges.put(challenge,Boolean.TRUE);
        }
        private Object pendingReceipt;private long originContinuous,originLogical,lastContinuous=-1,pendingOriginContinuous,pendingOriginLogical;
        private boolean invalid,originKnown;
        private LocalV2ProcessClock(String identity,LocalSnapshotV2Policy policy,LocalV2ElapsedClock clock) throws Exception {
            require(identity!=null&&!identity.isEmpty()&&policy!=null&&clock!=null);storageIdentity=identity;
            this.policy=new LocalSnapshotV2Policy(policy.version,policy.checksum,policy.maximumIterations,policy.delays);this.clock=clock;
        }
        private boolean samePolicy(LocalSnapshotV2Policy other){return other!=null&&policy.version.equals(other.version)&&policy.checksum.equals(other.checksum)
            &&policy.maximumIterations==other.maximumIterations&&Arrays.equals(policy.delays,other.delays);}
        private void invalidateLocked(){invalid=true;if(known!=null)known.wipe();if(pending!=null)pending.wipe();known=null;pending=null;pendingReceipt=null;}
        private synchronized void invalidate(LocalV2ClockLease lease){if(lease!=null&&active==lease&&!lease.closed)invalidateLocked();}
        private long nativeNow() throws Exception {
            long at;try{at=clock.now();}catch(Throwable error){invalidateLocked();if(error instanceof Error)throw(Error)error;
                throw error instanceof Exception?(Exception)error:new Unavailable();}
            if(invalid||at<0||at<lastContinuous){invalidateLocked();throw new Unavailable();}lastContinuous=at;return at;
        }
        private void own(LocalV2ClockLease lease) throws Exception {require(!invalid&&lease!=null&&lease.owner==this&&active==lease&&!lease.closed);}
        private synchronized LocalV2ClockLease claim(Object original,long timeout) throws Exception {
            if(invalid)throw new Unavailable();if(active!=null||original==null||timeout<=0||timeout>60000)throw new PinKnownRefusal();
            long at=nativeNow();if(originKnown)logicalAt(at);if(at>Long.MAX_VALUE-timeout){invalidateLocked();throw new Unavailable();}require(active==null&&!invalid);
            active=new LocalV2ClockLease(this,original,at,at+timeout);return active;
        }
        private synchronized LocalV2ClockLease claimUntil(Object original,long deadline) throws Exception {
            if(invalid)throw new Unavailable();if(active!=null||original==null)throw new PinKnownRefusal();
            long at=nativeNow();if(originKnown)logicalAt(at);if(deadline<=at||deadline-at>60000)throw new PinKnownRefusal();
            active=new LocalV2ClockLease(this,original,at,deadline);return active;
        }
        private synchronized long current(LocalV2ClockLease lease) throws Exception {
            own(lease);long at=nativeNow();own(lease);if(originKnown)logicalAt(at);if(at<lease.began||at>=lease.deadline)throw new PinKnownRefusal();return at;
        }
        private long logicalAt(long at) throws Exception {
            if(!originKnown||at<originContinuous||at-originContinuous>MAX_SAFE-originLogical){invalidateLocked();throw new Unavailable();}
            return originLogical+(at-originContinuous);
        }
        /** Called only after actual native locked read. A foreign full snapshot
         * can never inherit credit merely by matching credential/revisions. */
        private synchronized boolean inspect(LocalV2ClockLease lease,byte[] actual) throws Exception {
            current(lease);require(pending==null);if(known==null)return false;
            if(!known.matches(actual)){invalidateLocked();throw new Unavailable();}logicalAt(lastContinuous);return true;
        }
        private synchronized LocalV2ClockSample sampleSeed(LocalV2ClockLease lease,byte[] actual) throws Exception {
            long at=current(lease);require(pending==null);
            if(known==null){LocalV2ClockBinding first=new LocalV2ClockBinding(actual,policy,true);known=first;originContinuous=at;originLogical=0;originKnown=true;}
            else if(!known.seed||!known.matches(actual)){invalidateLocked();throw new Unavailable();}
            lease.sample=new LocalV2ClockSample(this,lease,known.checksum,at,logicalAt(at));return lease.sample;
        }
        private synchronized LocalV2ClockSample sample(LocalV2ClockLease lease,byte[] actual) throws Exception {
            long at=current(lease);require(pending==null&&known!=null);
            if(!known.matches(actual)){invalidateLocked();throw new Unavailable();}
            lease.sample=new LocalV2ClockSample(this,lease,known.checksum,at,logicalAt(at));return lease.sample;
        }
        private synchronized LocalV2ClockSample sampleReanchor(LocalV2ClockLease lease,byte[] actual) throws Exception {
            long at=current(lease);require(known==null&&pending==null);
            try(LocalSnapshotV2 old=LocalSnapshotV2.decode(actual,policy)){
                lease.sample=new LocalV2ClockSample(this,lease,old.checksum,at,old.lastObservedMs);return lease.sample;}
        }
        private synchronized long logical(LocalV2ClockLease lease,byte[] actual) throws Exception {return sample(lease,actual).logicalMs;}
        /** Publication remains pending until the ORIGINAL known ACK rereads it.
         * Origin is never replaced by ACK time or another UI request. */
        private synchronized void stage(LocalV2ClockLease lease,Object receipt,byte[] before,byte[] after,LocalV2ClockSample sample,LocalV2ClockAction action) throws Exception {
            long at=current(lease);require(pending==null&&receipt!=null&&sample!=null&&sample.owner==this&&sample.lease==lease&&lease.sample==sample
                &&!sample.consumed&&sample.continuousMs<=at&&sample.checksum.equals(digest(before)));sample.consumed=true;
            LocalV2ClockBinding next=null;byte[] expected=null;
            try{
                if(known==null){require(action==LocalV2ClockAction.reanchor&&!originKnown);
                    try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,policy)){expected=LocalSnapshotV2.reanchor(old);require(sample.logicalMs==old.lastObservedMs);}
                }else{require(known.matches(before)&&originKnown&&sample.logicalMs<=logicalAt(at));
                    if(action==LocalV2ClockAction.enroll){require(known.seed);try(LocalSnapshotV2 value=LocalSnapshotV2.decode(after,policy)){
                        LocalSnapshotV2.validateEnrollment(before,value,sample.logicalMs);}expected=after.clone();}
                    else{require(!known.seed);try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,policy);LocalSnapshotV2 value=LocalSnapshotV2.decode(after,policy)){
                        if(action==LocalV2ClockAction.profile){LocalV2InitialProfile.validate(old,value);expected=after.clone();}
                        else if(action==LocalV2ClockAction.charge)expected=LocalSnapshotV2.charge(old,value.pendingAttemptId,sample.logicalMs);
                        else{require(action==LocalV2ClockAction.finalize&&value.lastObservedMs==sample.logicalMs);
                            LocalSnapshotV2.validateFinalization(old,value);expected=LocalSnapshotV2.attempt(old,value.count,null,sample.logicalMs);}}}
                }
                require(MessageDigest.isEqual(expected,after));next=new LocalV2ClockBinding(after,policy,false);
                pendingOriginContinuous=originKnown?originContinuous:at;pendingOriginLogical=originKnown?originLogical:sample.logicalMs;
                require(next.lastObservedMs<=pendingOriginLogical+(at-pendingOriginContinuous));
                pending=next;next=null;pendingReceipt=receipt;
            }catch(Throwable error){invalidateLocked();if(error instanceof Error)throw(Error)error;throw error instanceof Exception?(Exception)error:new Unavailable();}
            finally{LocalSnapshotV2.wipe(expected);if(next!=null)next.wipe();}
        }
        private synchronized void acknowledge(LocalV2ClockLease lease,Object receipt,byte[] actual) throws Exception {
            long at=current(lease);require(pending!=null&&pendingReceipt==receipt);
            if(!pending.matches(actual)||at<pendingOriginContinuous||at-pendingOriginContinuous>MAX_SAFE-pendingOriginLogical){invalidateLocked();throw new Unavailable();}
            if(known!=null)known.wipe();known=pending;pending=null;pendingReceipt=null;
            originContinuous=pendingOriginContinuous;originLogical=pendingOriginLogical;originKnown=true;
        }
        private synchronized void closedReadback(LocalV2ClockLease original,String checksum) throws Exception {
            require(!invalid&&original!=null&&original.owner==this&&original.closed&&active==null&&known!=null&&pending==null&&known.checksum.equals(checksum));
            long at=nativeNow();if(originKnown)logicalAt(at);if(at<original.began||at>=original.deadline)throw new PinKnownRefusal();
        }
        private synchronized boolean pending(LocalV2ClockLease lease){return active==lease&&!lease.closed&&pendingReceipt!=null;}
        private synchronized void release(LocalV2ClockLease lease) throws Exception {
            require(lease!=null&&lease.owner==this&&active==lease&&!lease.closed);
            if(pendingReceipt!=null)invalidateLocked();lease.closed=true;lease.sample=null;active=null;
        }
    }

    /** Original retained native sample/data, not PIN or OS-owner permission.
     * Issued only after the exact already-existing seed was read under lock.
     * No caller time is accepted and no serialized uptime/process proof exists. */
    private static final class LocalV2EnrollmentSample {
        final LocalV2Writer owner;final LocalV2Request request;final long continuousMs,logicalMs;final String seedChecksum;
        private final byte[] seed;private final LocalV2ClockSample clockSample;private boolean consumed,closed;
        private LocalV2EnrollmentSample(LocalV2Writer owner,LocalV2Request request,byte[] owned) throws Exception {
            this.owner=owner;this.request=request;clockSample=request.processClock.sampleSeed(request.processLease,owned);
            continuousMs=clockSample.continuousMs;logicalMs=clockSample.logicalMs;
            seed=owned;seedChecksum=digest(owned);
        }
        private byte[] copySeed() throws Exception {synchronized(owner){owner.live(request);require(request.enrollmentSample==this
            &&!closed&&!consumed&&request.workers==0&&digest(seed).equals(seedChecksum));return seed.clone();}}
        private void wipe(){closed=true;LocalSnapshotV2.wipe(seed);}
    }
    private static final class LocalV2Request {
        final LocalV2Writer owner;final android.app.Activity activity;final android.os.IBinder token;
        final long began,deadline;final Object processIdentity;final LocalSnapshotV2Policy policy;
        final LocalV2ProcessClock processClock;final LocalV2ClockLease processLease;
        boolean anchored,cancelled,sealed,retiring,retired,detached,charged,mutationStarted,enrollmentStarted;
        int workers,mainCalls,events,settleCalls,pinWorkers,pinCancelCalls;boolean unacknowledgedMutation;LocalV2StorageReceipt receipt;LocalV2ChargedReservation reservation;
        private LocalV2PinOperation pinOperation;
        private LocalV2ProfileOperation profileOperation;
        private byte[] currentBytes;private String currentChecksum;
        private LocalV2EnrollmentSample enrollmentSample;
        android.app.Application.ActivityLifecycleCallbacks lifecycle;android.content.BroadcastReceiver screen;Runnable expiry;
        LocalV2Request(LocalV2Writer owner,android.app.Activity activity,android.os.IBinder token,LocalSnapshotV2Policy policy,long timeout) throws Exception {
            this(owner,activity,token,policy,timeout,0);
        }
        private LocalV2Request(LocalV2Writer owner,android.app.Activity activity,android.os.IBinder token,LocalSnapshotV2Policy policy,long timeout,long deadline) throws Exception {
            this.owner=owner;this.activity=activity;this.token=token;processIdentity=LocalV2Writer.PROCESS_IDENTITY;
            processClock=owner.processClock(policy);this.policy=new LocalSnapshotV2Policy(processClock.policy.version,processClock.policy.checksum,
                processClock.policy.maximumIterations,processClock.policy.delays);
            if(!processClock.samePolicy(this.policy))throw new PinKnownRefusal();
            processLease=deadline==0?processClock.claim(this,timeout):processClock.claimUntil(this,deadline);began=processLease.began;this.deadline=processLease.deadline;
        }
    }
    /** Actual existing-AES/AtomicFile/flock leaf, inaccessible from production:
     * V2 native owner/input/KDF is connected privately below. It never
     * consumes FirstInstallReceipt or a v1 PIN result as mutation permission.
     * Genuine Gate/admitted-data/App mapping remains unavailable. */
    private static final class LocalV2Writer {
        private static final Object PROCESS_IDENTITY=new Object();
        private static final Object CLOCK_SELECTION=new Object();private static LocalV2ProcessClock nativeProcessClock;
        final PlanetChildVault vault;private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
        private final LocalV2ProcessClock fixtureClock;
        private LocalV2Request active;private boolean reserving,sealed;
        private java.util.concurrent.FutureTask<Void> attachCleanup;private Thread attachCleanupWorker;
        private LocalV2Writer(PlanetChildVault vault) throws Exception {require(vault!=null);this.vault=vault;fixtureClock=null;}
        /** Isolated .dev instrumentation owner; never selected by the null
         * production factory. No synthetic clock enters the native singleton. */
        private LocalV2Writer(PlanetChildVault vault,LocalV2ProcessClock fixture) throws Exception {
            require(vault!=null&&fixture!=null&&(vault.context.getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0
                &&vault.context.getPackageName().endsWith(".dev"));this.vault=vault;fixtureClock=fixture;}
        private LocalV2ProcessClock processClock(LocalSnapshotV2Policy policy) throws Exception {
            if(fixtureClock!=null){if(!fixtureClock.samePolicy(policy))throw new PinKnownRefusal();return fixtureClock;}
            File parent=vault.context.getNoBackupFilesDir().getCanonicalFile(),record=new File(new File(parent,"literary-planet-child-vault-v1"),"full-record-v1");
            require(record.getAbsoluteFile().equals(record.getCanonicalFile()));String identity=vault.vaultIdentity+"|"+record.getCanonicalPath()+"|"+vault.vaultIdentity+".aes";
            synchronized(CLOCK_SELECTION){if(nativeProcessClock==null)nativeProcessClock=new LocalV2ProcessClock(identity,policy,SystemClock::elapsedRealtime);
                if(!nativeProcessClock.storageIdentity.equals(identity)||!nativeProcessClock.samePolicy(policy))throw new PinKnownRefusal();return nativeProcessClock;}
        }
        private synchronized void own(LocalV2Request request) throws Exception {require(request!=null&&request.owner==this&&active==request
            &&request.processIdentity==PROCESS_IDENTITY&&!request.retired);}
        private synchronized void live(LocalV2Request request) throws Exception {own(request);request.processClock.current(request.processLease);
            if(!request.processClock.samePolicy(request.policy))throw new PinKnownRefusal();
            if(sealed||request.sealed||request.cancelled||request.retiring)throw new PinKnownRefusal();}
        private LocalV2Request request(android.app.Activity activity,LocalSnapshotV2Policy policy,long timeout) throws Exception {
            return requestAt(activity,policy,timeout,0);
        }
        private LocalV2Request gateRequest(android.app.Activity activity,LocalSnapshotV2Policy policy,PinGateRequest original) throws Exception {
            require(original!=null);return requestAt(activity,policy,0,original.deadlineUptimeMs);
        }
        private LocalV2Request requestAt(android.app.Activity activity,LocalSnapshotV2Policy policy,long timeout,long deadline) throws Exception {
            synchronized(this){require(!reserving&&active==null&&!sealed);reserving=true;}
            try{require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&activity!=null&&activity.getClass()==MainActivity.class
                &&activity.getApplicationContext()==vault.context&&!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus()&&policy!=null);
                android.os.IBinder token=activity.getWindow().getDecorView().getWindowToken();require(token!=null);
                LocalV2Request value=new LocalV2Request(this,activity,token,policy,timeout,deadline);synchronized(this){require(active==null&&!sealed);active=value;}
                try{attach(value);}catch(Throwable failure){
                    // The handle has not escaped. Retain one owned retirement
                    // task while main unwinds; never release its lease merely
                    // because registration or a cleanup dispatch failed.
                    unknown(value);java.util.concurrent.FutureTask<Void> cleanup=new java.util.concurrent.FutureTask<>(()->{retire(value);return null;});
                    Thread worker=new Thread(cleanup,"planet-local-v2-attach-cleanup");
                    synchronized(this){require(attachCleanup==null&&attachCleanupWorker==null);attachCleanup=cleanup;attachCleanupWorker=worker;}
                    worker.start();throw failed(value,failure);
                }return value;
            }finally{synchronized(this){reserving=false;}}
        }
        private void event(LocalV2Request request){synchronized(this){if(active!=request||request.detached)return;request.events++;request.cancelled=true;
                if(request.unacknowledgedMutation||request.receipt!=null)request.processClock.invalidate(request.processLease);if(request.pinOperation!=null)request.pinOperation.revoke();if(request.profileOperation!=null)request.profileOperation.revoke();}
            synchronized(this){request.events--;wipeIdle(request);notifyAll();}}
        private void wipeIdle(LocalV2Request request){if((request.cancelled||request.sealed)&&request.workers==0&&request.pinWorkers==0&&request.pinCancelCalls==0&&request.settleCalls==0&&request.mainCalls==0&&request.events==0){
            LocalSnapshotV2.wipe(request.currentBytes);if(request.receipt!=null)request.receipt.wipe();if(request.reservation!=null)request.reservation.wipe();
            if(request.enrollmentSample!=null)request.enrollmentSample.wipe();}}
        private void paused(LocalV2Request request){synchronized(this){if(active!=request||request.detached)return;
            if(request.pinOperation!=null&&request.pinOperation.ownedOwnerPause()||request.profileOperation!=null&&request.profileOperation.ownedOwnerPause())return;}event(request);}
        private void attach(LocalV2Request request) throws Exception {
            android.app.Application application=(android.app.Application)vault.context;
            request.lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
                public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}public void onActivityStarted(android.app.Activity a){}
                public void onActivityResumed(android.app.Activity a){}public void onActivityPaused(android.app.Activity a){if(a==request.activity)paused(request);}
                public void onActivityStopped(android.app.Activity a){if(a==request.activity)event(request);}public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}
                public void onActivityDestroyed(android.app.Activity a){if(a==request.activity)event(request);}};
            application.registerActivityLifecycleCallbacks(request.lifecycle);
            request.screen=new android.content.BroadcastReceiver(){public void onReceive(android.content.Context c,android.content.Intent i){event(request);}};
            android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
            if(android.os.Build.VERSION.SDK_INT>=33)vault.context.registerReceiver(request.screen,filter,android.content.Context.RECEIVER_NOT_EXPORTED);
            else vault.context.registerReceiver(request.screen,filter);
            request.expiry=()->event(request);require(main.postDelayed(request.expiry,Math.max(1,request.deadline-SystemClock.elapsedRealtime())));
        }
        /** Main callbacks are joined outside IO. During IO, lifecycle/deadline
         * latches and native clock are checked without waiting for the UI. */
        private void onMain(LocalV2Request request,Runnable body,boolean cleanup) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());synchronized(this){own(request);require(!request.detached);request.mainCalls++;}
            boolean accepted=false;try{accepted=main.post(()->{try{body.run();}catch(Throwable failure){unknown(request);}
                finally{synchronized(this){request.mainCalls--;wipeIdle(request);notifyAll();}}});}
            finally{if(!accepted)synchronized(this){request.mainCalls--;unknown(request);wipeIdle(request);notifyAll();}}
            // Cancellation/deadline suppress publication but never reconstruct
            // completion while the ORIGINAL accepted main call is still live.
            require(accepted);synchronized(this){while(request.mainCalls>0)wait(10);if(!cleanup)live(request);}
        }
        private void host(LocalV2Request request) throws Exception {for(;;){live(request);final boolean[] current={false},lost={false};
            onMain(request,()->{lost[0]=request.activity.isFinishing()||request.activity.isDestroyed()||request.activity.getWindow().getDecorView().getWindowToken()!=request.token;
                current[0]=!lost[0]&&request.activity.hasWindowFocus();},false);
            if(current[0]){vault.unlocked();live(request);return;}
            LocalV2PinOperation operation=request.pinOperation;
            LocalV2ProfileOperation profile=request.profileOperation;
            if(lost[0]||!(operation!=null&&(operation.ownerReturned||operation.uiJoined)||profile!=null&&(profile.ownerReturned||profile.uiJoined))){event(request);throw new PinKnownRefusal();}
            // Only an actual owned system/keypad return may wait for focus;
            // lifecycle cancellation and the original deadline remain latched.
            synchronized(this){live(request);wait(10);}
        }}
        private synchronized void begin(LocalV2Request request) throws Exception {live(request);require(request.workers==0&&request.settleCalls==0&&request.receipt==null);request.workers++;}
        private synchronized void finish(LocalV2Request request){request.workers--;wipeIdle(request);notifyAll();}
        private synchronized long logical(LocalV2Request request) throws Exception {live(request);require(request.anchored&&request.currentBytes!=null);
            return request.processClock.logical(request.processLease,request.currentBytes);}
        private synchronized void unknown(LocalV2Request request){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;request.cancelled=true;wipeIdle(request);notifyAll();}
        private Exception failed(LocalV2Request request,Throwable failure){synchronized(this){if(failure instanceof PinKnownRefusal&&!request.unacknowledgedMutation
                &&request.receipt==null&&!request.processClock.pending(request.processLease))return(Exception)failure;}
            unknown(request);if(failure instanceof Error)throw(Error)failure;
            return failure instanceof Exception?(Exception)failure:new Unavailable();}
        /** V2 never asks AtomicFile to restore a backup or overwrite an orphan.
         * Exact ENOENT is the only accepted absence of temporary suffixes. */
        private void completeRecord(File directory) throws Exception {
            for(String suffix:new String[]{"",".bak",".new"}){File file=new File(directory,"full-record-v1"+suffix);
                try{StructStat stat=Os.lstat(file.getAbsolutePath());require(suffix.isEmpty()&&OsConstants.S_ISREG(stat.st_mode)
                    &&stat.st_size>=30&&stat.st_size<=MAX_BYTES+29);}
                catch(android.system.ErrnoException absent){require(!suffix.isEmpty()&&absent.errno==OsConstants.ENOENT);}}
        }
        private LocalV2StorageReceipt publish(LocalV2Request request,byte[] expected,byte[] next,File directory,
            LocalV2ClockSample sample,LocalV2ClockAction action) throws Exception {
            live(request);synchronized(this){if(request.currentBytes!=null)require(digest(request.currentBytes).equals(request.currentChecksum)
                &&MessageDigest.isEqual(expected,request.currentBytes));}
            completeRecord(directory);byte[] current=vault.readExact(directory);try{require(MessageDigest.isEqual(expected,current));}finally{LocalSnapshotV2.wipe(current);}
            if(action==LocalV2ClockAction.profile){require(request.profileOperation!=null);request.profileOperation.profileWriteBoundary(expected,next);}
            synchronized(this){request.mutationStarted=true;request.unacknowledgedMutation=true;}vault.writeExact(directory,next,()->{live(request);if(action==LocalV2ClockAction.profile)request.profileOperation.profileWriteBoundary(expected,next);});
            completeRecord(directory);byte[] readback=vault.readExact(directory),retained=null;LocalV2StorageReceipt receipt=null;boolean adopted=false;
            try{require(MessageDigest.isEqual(next,readback));live(request);if(action==LocalV2ClockAction.profile)request.profileOperation.profileWriteBoundary(expected,next);retained=readback.clone();
                receipt=new LocalV2StorageReceipt(this,request,readback);
                request.processClock.stage(request.processLease,receipt,expected,next,sample,action);
                synchronized(this){live(request);require(request.receipt==null);LocalSnapshotV2.wipe(request.currentBytes);
                    request.currentBytes=retained;retained=null;request.currentChecksum=receipt.checksum;request.receipt=receipt;adopted=true;readback=null;}return receipt;
            }finally{if(!adopted&&receipt!=null)receipt.wipe();LocalSnapshotV2.wipe(readback);LocalSnapshotV2.wipe(retained);}
        }
        private LocalV2StorageReceipt reanchor(LocalV2Request request) throws Exception {
            begin(request);byte[][] owned={null,null};try{host(request);synchronized(this){live(request);require(!request.anchored);}
                LocalV2StorageReceipt result=vault.locked(directory->{live(request);
                completeRecord(directory);owned[0]=vault.readExact(directory);try(LocalSnapshotV2 before=LocalSnapshotV2.decode(owned[0],request.policy)){
                    boolean warm=request.processClock.inspect(request.processLease,owned[0]);
                    if(warm){request.processClock.sample(request.processLease,owned[0]);synchronized(this){live(request);
                        LocalSnapshotV2.wipe(request.currentBytes);request.currentBytes=owned[0].clone();request.currentChecksum=before.checksum;request.anchored=true;}return null;}
                    LocalV2ClockSample sample=request.processClock.sampleReanchor(request.processLease,owned[0]);owned[1]=LocalSnapshotV2.reanchor(before);
                    LocalV2StorageReceipt receipt=publish(request,owned[0],owned[1],directory,sample,LocalV2ClockAction.reanchor);
                    synchronized(this){live(request);request.anchored=true;}return receipt;}});
                host(request);return result;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(owned[0]);LocalSnapshotV2.wipe(owned[1]);finish(request);}
        }
        /** Future genuine producer builds next from this ORIGINAL retained
         * native sample. Sampling alone authorizes neither KDF nor mutation. */
        private LocalV2EnrollmentSample sampleEnrollment(LocalV2Request request) throws Exception {
            begin(request);LocalV2EnrollmentSample sample=null;boolean adopted=false;
            try{host(request);synchronized(this){live(request);require(!request.anchored&&!request.enrollmentStarted&&request.enrollmentSample==null);request.enrollmentStarted=true;}
                sample=vault.locked(directory->{live(request);completeRecord(directory);byte[] current=vault.readExact(directory);
                    try(LocalEmptySeedV2 checked=LocalEmptySeedV2.decode(current,request.policy.version,request.policy.checksum)){
                        byte[] retained=current.clone();try{LocalV2EnrollmentSample original=new LocalV2EnrollmentSample(this,request,retained);retained=null;return original;}
                        finally{LocalSnapshotV2.wipe(retained);}}
                    finally{LocalSnapshotV2.wipe(current);}});
                host(request);synchronized(this){live(request);require(request.enrollmentSample==null);request.enrollmentSample=sample;adopted=true;}return sample;
            }catch(Throwable failure){throw failed(request,failure);}finally{if(!adopted&&sample!=null)sample.wipe();finish(request);}
        }
        private LocalV2StorageReceipt enroll(LocalV2Request request,LocalV2EnrollmentSample original,byte[] next) throws Exception {
            synchronized(this){live(request);enrollmentProducer(request,original,next);require(original!=null&&original.owner==this&&original.request==request&&request.enrollmentSample==original
                &&!original.closed&&!original.consumed&&!request.anchored);begin(request);original.consumed=true;}
            byte[] expected=null,replacement=null;
            try{require(next!=null&&next.length>0&&next.length<=MAX_BYTES);replacement=next.clone();host(request);
                synchronized(this){live(request);require(!original.closed&&digest(original.seed).equals(original.seedChecksum));expected=original.seed.clone();}
                final byte[] seed=expected,afterBytes=replacement;LocalV2StorageReceipt result=vault.locked(directory->{live(request);
                    long now=request.processClock.current(request.processLease);require(now>=original.continuousMs);
                    try(LocalSnapshotV2 after=LocalSnapshotV2.decode(afterBytes,request.policy)){LocalSnapshotV2.validateEnrollment(seed,after,original.logicalMs);
                        LocalV2StorageReceipt receipt=publish(request,seed,afterBytes,directory,original.clockSample,LocalV2ClockAction.enroll);
                        synchronized(this){live(request);request.anchored=true;}return receipt;}});
                host(request);return result;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(expected);LocalSnapshotV2.wipe(replacement);original.wipe();finish(request);}
        }
        private LocalV2StorageReceipt charge(LocalV2Request request) throws Exception {
            synchronized(this){live(request);chargeProducer(request);}
            begin(request);byte[][] owned={null,null};byte[] random=null;
            try{host(request);synchronized(this){live(request);require(request.anchored&&!request.charged&&request.reservation==null);}
                random=new byte[32];new java.security.SecureRandom().nextBytes(random);StringBuilder id=new StringBuilder(64);
                for(byte value:random){id.append("0123456789abcdef".charAt((value>>>4)&15));id.append("0123456789abcdef".charAt(value&15));}
                final String attempt=id.toString();LocalV2StorageReceipt result=vault.locked(directory->{live(request);completeRecord(directory);owned[0]=vault.readExact(directory);
                    try(LocalSnapshotV2 before=LocalSnapshotV2.decode(owned[0],request.policy)){
                        LocalV2ClockSample sample=request.processClock.sample(request.processLease,owned[0]);long at=sample.logicalMs;
                        if(at<before.blockedUntilMs)throw new PinKnownRefusal();synchronized(this){live(request);request.charged=true;}
                        owned[1]=LocalSnapshotV2.charge(before,attempt,at);
                        LocalV2StorageReceipt receipt=publish(request,owned[0],owned[1],directory,sample,LocalV2ClockAction.charge);byte[] reservationBytes=owned[1].clone();
                        try{LocalV2ChargedReservation reservation=new LocalV2ChargedReservation(this,request,attempt,reservationBytes);
                            synchronized(this){live(request);require(request.reservation==null);request.reservation=reservation;reservationBytes=null;}
                        }finally{LocalSnapshotV2.wipe(reservationBytes);}return receipt;}});
                host(request);return result;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(random);LocalSnapshotV2.wipe(owned[0]);LocalSnapshotV2.wipe(owned[1]);finish(request);}
        }
        private LocalV2PinOperation enrollmentOperation(LocalV2Request request,Object originalChallenge,String id,long generation,String locale,long iterations) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());synchronized(this){live(request);require(request.pinOperation==null&&!request.anchored);}
            LocalV2EnrollmentSample sample=sampleEnrollment(request);byte[] seed=sample.copySeed();
            try{LocalV2PinOperation operation=new LocalV2PinOperation(this,request,LocalV2PinKind.enroll,null,originalChallenge,id,"enroll-local-pin",digest(seed),generation,locale,iterations,seed,sample);
                synchronized(this){live(request);require(request.pinOperation==null);request.pinOperation=operation;}return operation;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(seed);}
        }
        private LocalV2PinOperation verificationOperation(LocalV2Request request,PinGateRequest original,String locale) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());synchronized(this){live(request);require(request.pinOperation==null&&original!=null&&original.deadlineUptimeMs==request.deadline);}
            LocalV2StorageReceipt anchor=reanchor(request);if(anchor!=null)acknowledge(anchor);byte[] bytes;
            synchronized(this){live(request);require(request.anchored&&request.receipt==null&&request.currentBytes!=null);bytes=request.currentBytes.clone();}
            try(LocalSnapshotV2 record=LocalSnapshotV2.decode(bytes,request.policy)){
                LocalV2PinOperation operation=new LocalV2PinOperation(this,request,LocalV2PinKind.verify,original,original.originalHostChallenge,original.id,original.action,original.targetChecksum,original.generation,locale,
                    LocalV2PinOperation.verifier(record).iterations,bytes,null);
                synchronized(this){live(request);require(request.pinOperation==null);request.pinOperation=operation;}return operation;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(bytes);}
        }
        private void enrollmentProducer(LocalV2Request request,LocalV2EnrollmentSample sample,byte[] next) throws Exception {
            LocalV2PinOperation operation=request.pinOperation;require(operation!=null&&operation.writer==this&&operation.request==request
                &&operation.kind==LocalV2PinKind.enroll&&operation.started&&operation.worker==Thread.currentThread()
                &&operation.phase==LocalV2PinPhase.finalizing&&operation.enrollment==sample&&operation.uiJoined&&operation.ownerConsumed
                &&!operation.ownerPermitSpent&&operation.platformEnrolled&&operation.enrollmentCandidate==next&&next!=null
                &&operation.ownerNextChecksum.equals(digest(next))&&MessageDigest.isEqual(operation.original,sample.seed));
            operation.verifyOwner();operation.ownerPermitSpent=true;
        }
        private void chargeProducer(LocalV2Request request) throws Exception {
            LocalV2PinOperation operation=request.pinOperation;require(operation!=null&&operation.writer==this&&operation.request==request
                &&operation.kind==LocalV2PinKind.verify&&operation.started&&operation.worker==Thread.currentThread()
                &&operation.phase==LocalV2PinPhase.charging&&operation.uiJoined&&operation.entered!=null
                &&operation.entered.length>0&&operation.entered.length<=128&&!operation.cancelled);
            operation.live();require(MessageDigest.isEqual(operation.original,request.currentBytes));
        }
        private void exactCharged(LocalV2PinOperation operation,LocalV2ChargedReservation reservation) throws Exception {
            require(operation!=null&&operation.writer==this&&reservation!=null&&reservation.owner==this&&reservation.request==operation.request);
            LocalV2Request request=operation.request;synchronized(this){operation.live();require(request.pinOperation==operation&&request.reservation==reservation&&!reservation.closed
                &&request.receipt==null&&!request.unacknowledgedMutation&&request.currentBytes!=null&&request.currentChecksum.equals(reservation.checksum)
                &&digest(reservation.charged).equals(reservation.checksum)&&MessageDigest.isEqual(request.currentBytes,reservation.charged));}
            vault.locked(directory->{operation.live();completeRecord(directory);byte[] actual=vault.readExact(directory);
                try{require(digest(actual).equals(reservation.checksum)&&MessageDigest.isEqual(actual,reservation.charged));operation.live();return null;}
                finally{LocalSnapshotV2.wipe(actual);}});
        }
        private LocalV2StorageReceipt finalizeAttempt(LocalV2PinOperation operation,LocalV2PinComparison original) throws Exception {
            require(operation!=null&&operation.writer==this);LocalV2Request request=operation.request;
            synchronized(this){operation.live();require(request.pinOperation==operation&&operation.kind==LocalV2PinKind.verify&&operation.worker==Thread.currentThread()
                &&operation.phase==LocalV2PinPhase.finalizing&&operation.comparison==original&&original!=null&&original.operation==operation
                &&original.reservation==request.reservation&&operation.platformCompared&&operation.uiJoined&&request.receipt==null&&!request.unacknowledgedMutation);}
            exactCharged(operation,original.reservation);begin(request);byte[] before=null,next=null;
            try{host(request);synchronized(this){live(request);before=request.reservation.charged.clone();}
                final byte[] expected=before;final byte[][] output={null};LocalV2StorageReceipt receipt=vault.locked(directory->{operation.live();completeRecord(directory);
                    byte[] actual=vault.readExact(directory);try{require(MessageDigest.isEqual(actual,expected));}finally{LocalSnapshotV2.wipe(actual);}
                    LocalV2ClockSample sample=request.processClock.sample(request.processLease,expected);output[0]=original.finalizeBytes(request.policy,sample.logicalMs);
                    try{return publish(request,expected,output[0],directory,sample,LocalV2ClockAction.finalize);}
                    finally{LocalSnapshotV2.wipe(output[0]);}});host(request);return receipt;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(before);LocalSnapshotV2.wipe(next);finish(request);}
        }

        private void acknowledge(LocalV2StorageReceipt receipt) throws Exception {
            require(receipt!=null&&receipt.owner==this);LocalV2Request request=receipt.request;
            synchronized(this){live(request);require(request.receipt==receipt&&!receipt.closed&&request.workers==0&&request.settleCalls==0);request.settleCalls++;}
            byte[] current=null;try{host(request);current=vault.locked(directory->{live(request);completeRecord(directory);return vault.readExact(directory);});
                require(digest(current).equals(receipt.checksum)&&MessageDigest.isEqual(current,receipt.bytes));host(request);
                synchronized(this){live(request);require(request.receipt==receipt&&!receipt.closed);
                    request.processClock.acknowledge(request.processLease,receipt,current);receipt.wipe();request.receipt=null;request.unacknowledgedMutation=false;}
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(current);synchronized(this){request.settleCalls--;wipeIdle(request);notifyAll();}}
        }
        private synchronized void cancel(LocalV2Request request) throws Exception {own(request);request.cancelled=true;
            if(request.unacknowledgedMutation||request.receipt!=null)request.processClock.invalidate(request.processLease);
            if(request.pinOperation!=null)request.pinOperation.revoke();if(request.profileOperation!=null)request.profileOperation.revoke();wipeIdle(request);notifyAll();}
        private void retire(LocalV2Request request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());LocalV2PinOperation operation;
            synchronized(this){own(request);require(!request.retiring);operation=request.pinOperation;
                require(operation==null||operation.worker!=Thread.currentThread());LocalV2ProfileOperation profile=request.profileOperation;
                require(profile==null||profile.worker!=Thread.currentThread());request.retiring=true;request.cancelled=true;
                if(profile!=null&&!profile.finished)profile.revoke();
                if(operation!=null&&!operation.finished)operation.revoke();
                while(request.workers>0||request.pinWorkers>0||request.pinCancelCalls>0||request.settleCalls>0||request.mainCalls>0||request.events>0)wait(10);}
            if(operation!=null&&operation.worker!=null){operation.worker.join();operation.joinCancel();}
            if(request.profileOperation!=null&&request.profileOperation.worker!=null){request.profileOperation.worker.join();request.profileOperation.joinCancel();}
            final boolean[] cleaned={false};try{onMain(request,()->{
                    // Attempt every observer removal even if an earlier one
                    // throws; a timer must not retain the retired Activity.
                    try{if(request.lifecycle!=null)((android.app.Application)vault.context).unregisterActivityLifecycleCallbacks(request.lifecycle);}
                    finally{try{if(request.screen!=null)vault.context.unregisterReceiver(request.screen);}
                        finally{if(request.expiry!=null)main.removeCallbacks(request.expiry);}}cleaned[0]=true;},true);
                synchronized(this){own(request);require(request.retiring&&request.workers==0&&request.pinWorkers==0&&request.pinCancelCalls==0&&request.settleCalls==0&&request.mainCalls==0&&request.events==0);
                    if(request.receipt!=null||request.unacknowledgedMutation){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;}
                    if(!cleaned[0]||sealed||request.sealed){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;}
                    request.detached=cleaned[0];LocalSnapshotV2.wipe(request.currentBytes);if(request.receipt!=null){request.receipt.wipe();request.receipt=null;}if(request.reservation!=null)request.reservation.wipe();
                    if(request.enrollmentSample!=null)request.enrollmentSample.wipe();
                    // Only after every real callback and cleanup returned can
                    // the static slot drop the original Activity/request graph.
                    request.processClock.release(request.processLease);request.retired=true;active=null;if(operation!=null)operation.wipeOriginal();if(sealed||request.sealed)throw new Unavailable();}
            }catch(Throwable failure){unknown(request);synchronized(this){if(request.workers==0&&request.settleCalls==0){if(request.receipt!=null)request.receipt.wipe();if(request.reservation!=null)request.reservation.wipe();}}throw failed(request,failure);}
        }
    }
    /** One original native operation. Device-owner enrollment, input, slow
     * derivation and verification never import a v1/P1 authority receipt. The
     * original lease remains held through actual UI/worker/recipient joins. */
    private enum LocalV2PinKind { enroll, verify }
    private enum LocalV2PinPhase { captured, owner, input, deriving, charging, comparing, finalizing, delivering, finished, closed }
    private interface LocalV2PinRecipient { void completed(LocalV2PinReply originalOrNull) throws Exception; }
    /** Strict V2 extraction and existing real platform math only. A result of
     * this leaf has no write permission; the writer requires its original
     * durably charged/ACKed reservation and operation-owned comparison. */
    private static final class LocalV2PinVerifier {
        final long iterations;final String saltHex,hashHex;
        private LocalV2PinVerifier(long iterations,String salt,String hash){this.iterations=iterations;saltHex=salt;hashHex=hash;}
        private PinVerificationOutcome compare(byte[] owned,PinPrimitiveCheck chargedFence) throws Exception {
            require(owned!=null);byte[] pin=null,salt=null,expected=null,derived=new byte[32];
            try{require(owned.length>0&&owned.length<=128&&chargedFence!=null);pin=owned.clone();chargedFence.check();
                boolean digits=true;for(byte digit:pin)digits&=digit>=48&&digit<=57;
                if(!digits){chargedFence.check();return PinVerificationOutcome.mismatch;}
                salt=PinNativePrimitives.hexBytes(saltHex);expected=PinNativePrimitives.hexBytes(hashHex);
                new PinVerificationPlatformKdf().derive(pin,salt,iterations,derived,chargedFence);chargedFence.check();
                return MessageDigest.isEqual(expected,derived)?PinVerificationOutcome.match:PinVerificationOutcome.mismatch;
            }finally{LocalSnapshotV2.wipe(owned);LocalSnapshotV2.wipe(pin);LocalSnapshotV2.wipe(salt);LocalSnapshotV2.wipe(expected);LocalSnapshotV2.wipe(derived);}
        }
    }
    private static final class LocalV2PinComparison implements AutoCloseable {
        final LocalV2PinOperation operation;final LocalV2ChargedReservation reservation;final String checksum;
        private final PinVerificationOutcome outcome;private final byte[] charged;private boolean consumed,closed;
        private LocalV2PinComparison(LocalV2PinOperation operation,LocalV2ChargedReservation reservation,
            PinVerificationOutcome outcome,byte[] bytes) throws Exception {
            require(operation!=null&&reservation!=null&&reservation.request==operation.request&&outcome!=null
                &&operation.platformCompared&&operation.phase==LocalV2PinPhase.comparing
                &&operation.request.reservation==reservation&&!reservation.closed&&reservation.checksum.equals(digest(bytes))
                &&MessageDigest.isEqual(reservation.charged,bytes));
            this.operation=operation;this.reservation=reservation;this.outcome=outcome;charged=bytes.clone();checksum=digest(bytes);
        }
        private byte[] finalizeBytes(LocalSnapshotV2Policy policy,long logical) throws Exception {
            synchronized(operation.writer){require(!closed&&!consumed&&operation.comparison==this
                &&operation.phase==LocalV2PinPhase.finalizing&&operation.platformCompared&&operation.worker==Thread.currentThread()
                &&operation.request.reservation==reservation&&!reservation.closed&&checksum.equals(digest(charged))
                &&MessageDigest.isEqual(charged,reservation.charged));consumed=true;}
            try(LocalSnapshotV2 original=LocalSnapshotV2.decode(charged,policy)){
                require(original.pendingAttemptId.equals(reservation.attemptId));
                return LocalSnapshotV2.attempt(original,outcome==PinVerificationOutcome.match?0:original.count,null,logical);
            }
        }
        public void close(){synchronized(operation.writer){closed=true;LocalSnapshotV2.wipe(charged);}}
    }
    /** Opaque until original native delivery returns, worker/cancel joins and
     * known settlement retire the real lifecycle/clock lease. It is not a
     * Parent Gate capability; the genuine Gate host is still unavailable. */
    private static final class LocalV2PinReply implements AutoCloseable {
        final LocalV2PinOperation operation;final PinGateRequest gate;final String checksum;final LocalV2PinKind kind;
        private final PinVerificationOutcome outcome;private boolean disposed,settled,consumed;
        private LocalV2PinReply(LocalV2PinOperation operation,PinVerificationOutcome outcome,String checksum) throws Exception {
            require(operation!=null&&ProtectedEnvelope.hash(checksum)&&operation.finalAcknowledged
                &&(operation.kind==LocalV2PinKind.enroll?operation.ownerConsumed&&operation.platformEnrolled:operation.platformCompared));
            synchronized(operation.writer){operation.live();require(operation.started&&operation.worker==Thread.currentThread()&&operation.phase==LocalV2PinPhase.finalizing
                &&operation.request.receipt==null&&!operation.request.unacknowledgedMutation&&operation.request.currentChecksum.equals(checksum)
                &&operation.request.processClock.inspect(operation.request.processLease,operation.request.currentBytes));
                if(operation.kind==LocalV2PinKind.enroll){require(operation.ownerPermitSpent);operation.verifyOwner();}
                else require(operation.comparison!=null&&operation.comparison.consumed&&!operation.comparison.closed&&operation.comparison.outcome==outcome);}
            this.operation=operation;gate=operation.gate;kind=operation.kind;this.outcome=outcome;this.checksum=checksum;
        }
        private PinVerificationOutcome consume(PinGateRequest original) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            synchronized(operation.writer){require(!disposed&&!consumed&&settled&&operation.reply==this&&operation.finished
                &&operation.knownSettlement&&!operation.closedRevoked&&operation.request.retired&&operation.request.detached&&!operation.request.sealed
                &&operation.worker!=null&&!operation.worker.isAlive()&&operation.cancelWorker==null
                &&operation.kind==LocalV2PinKind.verify&&gate==original&&original!=null&&operation.originalChallenge==original.originalHostChallenge
                &&operation.finalAcknowledged&&operation.platformCompared&&outcome==PinVerificationOutcome.match);
                operation.request.processClock.closedReadback(operation.request.processLease,checksum);
                consumed=true;}
            // Spend before any fresh read; failure/uncertainty cannot retry the
            // original transfer or recover a fresh permission from this fact.
            try{operation.closedHost();operation.writer.vault.locked(directory->{operation.writer.completeRecord(directory);byte[] actual=operation.writer.vault.readExact(directory);
                try{require(digest(actual).equals(checksum));operation.request.processClock.closedReadback(operation.request.processLease,checksum);return null;}
                finally{LocalSnapshotV2.wipe(actual);}});
            operation.closedHost();synchronized(operation.writer){require(!disposed&&operation.knownSettlement&&!operation.closedRevoked&&!operation.request.sealed);
                operation.request.processClock.closedReadback(operation.request.processLease,checksum);return outcome;}}
            finally{operation.closedObservers(false);}
        }
        public void close(){synchronized(operation.writer){disposed=true;}}
    }
    private static final class LocalV2PinOperation {
        final LocalV2Writer writer;final LocalV2Request request;final LocalV2PinKind kind;final PinGateRequest gate;
        final Object originalChallenge;final String id,action,targetChecksum,locale,originalChecksum;
        final long generation,iterations,originalRevision,originalPinRevision,originalJournalRevision;
        private final byte[] original,nonce,payload;private LocalV2EnrollmentSample enrollment;
        private volatile Thread worker,cancelWorker;private LocalV2PinPhase phase=LocalV2PinPhase.captured;
        private boolean started,cancelled,finished,delivered,deliveryEntered,knownSettlement,ownerConsumed,ownerPermitSpent,platformEnrolled,platformCompared,finalAcknowledged;
        private volatile boolean closedRevoked;private android.app.Application.ActivityLifecycleCallbacks closedLifecycle;
        private android.content.BroadcastReceiver closedScreen;private Runnable closedExpiry;
        private void closedObservers(boolean install) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            java.util.concurrent.FutureTask<Void> task=new java.util.concurrent.FutureTask<>(()->{
                android.app.Application app=(android.app.Application)writer.vault.context;
                if(install){
                    closedLifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
                        public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}public void onActivityStarted(android.app.Activity a){}
                        public void onActivityResumed(android.app.Activity a){}public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}
                        public void onActivityPaused(android.app.Activity a){if(a==request.activity)closedRevoked=true;}
                        public void onActivityStopped(android.app.Activity a){if(a==request.activity)closedRevoked=true;}
                        public void onActivityDestroyed(android.app.Activity a){if(a==request.activity)closedRevoked=true;}};
                    app.registerActivityLifecycleCallbacks(closedLifecycle);
                    closedScreen=new android.content.BroadcastReceiver(){public void onReceive(android.content.Context c,android.content.Intent i){closedRevoked=true;}};
                    android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
                    if(android.os.Build.VERSION.SDK_INT>=33)writer.vault.context.registerReceiver(closedScreen,filter,android.content.Context.RECEIVER_NOT_EXPORTED);
                    else writer.vault.context.registerReceiver(closedScreen,filter);
                    closedExpiry=()->{closedRevoked=true;try{removeClosedOnMain();}catch(Throwable failure){closedRevoked=true;}};
                    require(writer.main.postDelayed(closedExpiry,Math.max(1,request.deadline-SystemClock.elapsedRealtime())));
                }else removeClosedOnMain();return null;
            });
            require(writer.main.post(task));boolean interrupted=false;
            for(;;)try{task.get();break;}catch(InterruptedException ignored){interrupted=true;}
            if(interrupted){Thread.currentThread().interrupt();throw new PinKnownRefusal();}
        }
        private void removeClosedOnMain(){
            try{if(closedLifecycle!=null)((android.app.Application)writer.vault.context).unregisterActivityLifecycleCallbacks(closedLifecycle);}
            finally{try{if(closedScreen!=null)writer.vault.context.unregisterReceiver(closedScreen);}
                finally{if(closedExpiry!=null)writer.main.removeCallbacks(closedExpiry);closedLifecycle=null;closedScreen=null;closedExpiry=null;}}
        }
        private void closedHost() throws Exception {
            java.util.concurrent.FutureTask<Boolean> task=new java.util.concurrent.FutureTask<>(()->!closedRevoked&&!request.activity.isFinishing()
                &&!request.activity.isDestroyed()&&request.activity.hasWindowFocus()&&request.activity.getWindow().getDecorView().getWindowToken()==request.token);
            require(writer.main.post(task));boolean interrupted=false,current=false;
            for(;;)try{current=task.get();break;}catch(InterruptedException ignored){interrupted=true;}
            if(interrupted){Thread.currentThread().interrupt();throw new PinKnownRefusal();}
            require(current);writer.vault.unlocked();require(!closedRevoked);
        }
        private int recipients,cancelCalls;private LocalV2PinComparison comparison;private LocalV2PinReply reply;
        private byte[] enrollmentCandidate;private String ownerNextChecksum;
        private java.security.Signature signing;private java.security.PublicKey publicKey;private byte[] keyEncoding,signature;
        private android.hardware.biometrics.BiometricPrompt.CryptoObject crypto;private android.os.CancellationSignal signal;
        private boolean promptOutstanding,ownerReturned,cancelIssued;private Exception promptError;
        private android.app.Dialog dialog;private android.view.ViewTreeObserver.OnWindowFocusChangeListener focusObserver;
        private android.widget.TextView subtitle,mask,count;private android.widget.Button next;private android.widget.LinearLayout keypad;
        private final byte[] edit=new byte[128];private byte[] first,entered;private int length,stage;private boolean ready,uiJoined,shown,accepting,everFocused;
        private LocalV2PinOperation(LocalV2Writer writer,LocalV2Request request,LocalV2PinKind kind,PinGateRequest gate,
            Object challenge,String id,String action,String target,long generation,String locale,long iterations,
            byte[] bytes,LocalV2EnrollmentSample enrollment) throws Exception {
            require(writer!=null&&request!=null&&kind!=null&&challenge!=null&&ProtectedEnvelope.hash(id)&&ProtectedEnvelope.hash(target)
                &&generation>=0&&generation<=MAX_SAFE&&("ru".equals(locale)||"en".equals(locale))&&iterations>=600000
                &&iterations<=request.policy.maximumIterations&&iterations<=Integer.MAX_VALUE&&bytes!=null);
            this.writer=writer;this.request=request;this.kind=kind;this.gate=gate;originalChallenge=challenge;this.id=id;this.action=action;
            targetChecksum=target;this.generation=generation;this.locale=locale;this.iterations=iterations;this.enrollment=enrollment;
            original=bytes.clone();originalChecksum=digest(original);
            if(kind==LocalV2PinKind.enroll){require(gate==null&&"enroll-local-pin".equals(action)&&enrollment!=null&&enrollment.request==request
                    &&target.equals(originalChecksum)&&request.enrollmentSample==enrollment);
                try(LocalEmptySeedV2 seed=LocalEmptySeedV2.decode(original,request.policy.version,request.policy.checksum)){}
                originalRevision=1;originalPinRevision=0;originalJournalRevision=0;
            }else{require(gate!=null&&gate.originalHostChallenge==challenge&&gate.id.equals(id)&&gate.action.equals(action)
                    &&gate.targetChecksum.equals(target)&&gate.generation==generation&&gate.deadlineUptimeMs==request.deadline&&enrollment==null);
                try(LocalSnapshotV2 record=LocalSnapshotV2.decode(original,request.policy)){
                    originalRevision=record.revision;originalPinRevision=record.pinRevision;originalJournalRevision=record.journalRevision;
                    context(record,gate);require(verifier(record).iterations==iterations);
                }
            }
            nonce=new byte[32];new java.security.SecureRandom().nextBytes(nonce);payload=payload();
            request.processClock.claimPin(request.processLease,id,originalChallenge);
        }
        private static LocalV2PinVerifier verifier(LocalSnapshotV2 record) throws Exception {
            byte[] raw=record.copy();try{ProtectedEnvelope.Cursor cursor=new ProtectedEnvelope.Cursor(new String(raw,record.pinStart,record.pinEnd-record.pinStart,StandardCharsets.US_ASCII));
                cursor.field("schemaVersion",true);cursor.number(1,1);cursor.field("policyVersion",false);require(cursor.string().equals(record.policy.version));
                cursor.field("revision",false);require(cursor.number(1,MAX_SAFE)==record.pinRevision);cursor.field("credentialId",false);require(cursor.string().equals(record.credentialId));
                cursor.field("verifier",false);cursor.field("algorithm",true);require(cursor.string().equals("PBKDF2-HMAC-SHA256"));cursor.field("iterations",false);long iterations=cursor.number(600000,record.policy.maximumIterations);
                cursor.field("saltHex",false);String salt=cursor.string();cursor.field("hashHex",false);String hash=cursor.string();require(ProtectedEnvelope.hash(salt)&&ProtectedEnvelope.hash(hash));
                return new LocalV2PinVerifier(iterations,salt,hash);
            }finally{LocalSnapshotV2.wipe(raw);}
        }
        private static void context(LocalSnapshotV2 record,PinGateRequest gate) throws Exception {
            byte[] raw=record.copy();try{ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,record.protectedStart,record.protectedEnd-record.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);p.number(1,MAX_SAFE);p.field("mode",false);require(p.string().equals(gate.context.mode));
                p.field("selectionRevision",false);require(p.number(1,MAX_SAFE)==gate.context.routeRevision);p.field("profileRevision",false);require(p.number(1,MAX_SAFE)==gate.context.profileRevision);
                p.field("policyChecksum",false);require(p.string().equals(record.policy.checksum));p.field("registryChecksum",false);p.string();p.field("registry",false);
                require(ProtectedEnvelope.registry(p,record.policy.version).equals(gate.context.profileId)&&record.policy.version.equals(gate.context.policyVersion));
            }finally{LocalSnapshotV2.wipe(raw);}
        }
        private byte[] payload() throws Exception {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
            out.write("LP-LOCAL-V2-PIN-OPERATION\0v2\0".getBytes(StandardCharsets.US_ASCII));out.writeByte(kind==LocalV2PinKind.enroll?1:2);
            for(String value:new String[]{id,action,targetChecksum,locale,originalChecksum,request.policy.version,request.policy.checksum,PinNativeOwnerAuthority.alias(request.activity)}){
                byte[] field=value.getBytes(StandardCharsets.UTF_8);try{out.writeInt(field.length);out.write(field);}finally{LocalSnapshotV2.wipe(field);}}
            for(long value:new long[]{generation,iterations,originalRevision,originalPinRevision,originalJournalRevision,request.began,request.deadline})out.writeLong(value);
            if(gate!=null){for(String value:new String[]{gate.context.profileId,gate.context.policyVersion,gate.context.mode,gate.context.visibility})out.writeUTF(value);
                out.writeLong(gate.context.profileRevision);out.writeLong(gate.context.routeRevision);}
            out.write(nonce);out.flush();return bytes.toByteArray();
        }
        private void identity() throws Exception {writer.own(request);require(request.pinOperation==this&&writer==request.owner&&originalChecksum.equals(digest(original))
                &&(kind!=LocalV2PinKind.verify||gate.originalHostChallenge==originalChallenge&&gate.id.equals(id)&&gate.action.equals(action)
                    &&gate.targetChecksum.equals(targetChecksum)&&gate.generation==generation&&gate.deadlineUptimeMs==request.deadline));
            byte[] checked=payload();try{require(MessageDigest.isEqual(payload,checked));}finally{LocalSnapshotV2.wipe(checked);}}
        private void live() throws Exception {synchronized(writer){identity();writer.live(request);if(cancelled||Thread.currentThread().isInterrupted())throw new PinKnownRefusal();}}
        private void originalReadback() throws Exception {live();writer.host(request);writer.vault.locked(directory->{live();writer.completeRecord(directory);
                byte[] raw=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(raw,original));live();return null;}finally{LocalSnapshotV2.wipe(raw);}});live();}
        private void start(LocalV2PinRecipient recipient) throws Exception {require(recipient!=null);synchronized(writer){live();require(!started&&request.workers==0&&request.receipt==null);
                started=true;request.pinWorkers++;worker=new Thread(()->run(recipient),"planet-local-v2-pin-operation");try{worker.start();}
                catch(Throwable failure){request.pinWorkers--;finished=true;writer.unknown(request);throw failure;}}}
        private void revoke(){android.os.CancellationSignal cancellation;synchronized(writer){cancelled=true;accepting=false;LocalSnapshotV2.wipe(edit);length=0;cancellation=signal;
                if(cancellation==null||cancelWorker!=null||cancelIssued)return;cancelIssued=true;cancelCalls++;request.pinCancelCalls++;
                cancelWorker=new Thread(()->{try{cancellation.cancel();}catch(Throwable failure){writer.unknown(request);}
                    finally{synchronized(writer){cancelCalls--;request.pinCancelCalls--;writer.notifyAll();}}},"planet-local-v2-pin-cancel");cancelWorker.start();writer.notifyAll();}}
        private void joinCancel() throws Exception {Thread originalCancel;synchronized(writer){originalCancel=cancelWorker;}if(originalCancel!=null){boolean interrupted=false;
                for(;;)try{originalCancel.join();break;}catch(InterruptedException ignored){interrupted=true;}
                synchronized(writer){require(cancelCalls==0);cancelWorker=null;}if(interrupted)Thread.currentThread().interrupt();}}
        private void joinPrompt(){boolean interrupted=false;synchronized(writer){while(promptOutstanding||request.events!=0){try{writer.wait();}catch(InterruptedException ignored){interrupted=true;}}}
            if(interrupted)Thread.currentThread().interrupt();}
        private void owner() throws Exception {
            require(android.os.Build.VERSION.SDK_INT>=30);originalReadback();phase=LocalV2PinPhase.owner;
            KeyguardManager guard=(KeyguardManager)request.activity.getSystemService(Context.KEYGUARD_SERVICE);require(guard!=null&&guard.isDeviceSecure());
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias=PinNativeOwnerAuthority.alias(request.activity);
            // The real setup owns key provisioning. Missing/invalidation never
            // triggers generation, deletion, re-enrollment or PIN reset here.
            require(keys.containsAlias(alias));PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,alias);
            signing=material.signature;publicKey=material.publicKey;keyEncoding=material.encoding;crypto=material.crypto;signal=new android.os.CancellationSignal();
            writer.onMain(request,()->{try{live();require(request.activity.hasWindowFocus());android.hardware.biometrics.BiometricPrompt prompt=
                    new android.hardware.biometrics.BiometricPrompt.Builder(request.activity).setTitle(label(R.string.native_owner_enroll_title))
                    .setSubtitle(label(R.string.native_owner_device_credential_reason)).setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build();
                    synchronized(writer){live();promptOutstanding=true;}
                    prompt.authenticate(crypto,signal,task->{synchronized(writer){request.events++;}boolean accepted=writer.main.post(()->{try{task.run();}
                        finally{synchronized(writer){request.events--;writer.notifyAll();}}});if(!accepted){synchronized(writer){request.events--;writer.unknown(request);}}},
                        new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback(){
                            public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){terminal(result,null);}
                            public void onAuthenticationError(int error,CharSequence message){terminal(null,new PinKnownRefusal());}});
                }catch(Exception failure){synchronized(writer){promptError=failure;cancelled=true;writer.notifyAll();}revoke();}},false);
            for(;;){synchronized(writer){if(!promptOutstanding&&request.events==0)break;writer.wait(25);}try{live();}catch(Exception failure){revoke();}}
            joinCancel();live();require(promptError==null&&ownerReturned);originalReadback();
        }
        private void terminal(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result,Exception error){synchronized(writer){if(request.detached||writer.active!=request)return;
                if(!promptOutstanding){writer.unknown(request);return;}promptOutstanding=false;promptError=error;
                ownerReturned=result!=null&&result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL
                    &&result.getCryptoObject()==crypto&&result.getCryptoObject().getSignature()==signing;if(!ownerReturned)cancelled=true;writer.notifyAll();}}
        private boolean ownedOwnerPause(){return kind==LocalV2PinKind.enroll&&phase==LocalV2PinPhase.owner&&promptOutstanding&&!ownerReturned
            &&!finished&&!cancelled&&signal!=null&&crypto!=null&&signing!=null&&crypto.getSignature()==signing;}
        private void verifyOwner() throws Exception {live();require(ownerReturned&&signature!=null&&signature.length>=8&&signature.length<=80&&publicKey!=null);
            byte[] encoding=publicKey.getEncoded();try{require(MessageDigest.isEqual(encoding,keyEncoding));java.security.Signature check=java.security.Signature.getInstance("SHA256withECDSA");
                check.initVerify(publicKey);check.update(payload);require(ProtectedEnvelope.hash(ownerNextChecksum));check.update(ownerNextChecksum.getBytes(StandardCharsets.US_ASCII));require(check.verify(signature));}finally{LocalSnapshotV2.wipe(encoding);}}
        private android.content.Context localeContext(){android.content.res.Configuration configuration=new android.content.res.Configuration(request.activity.getResources().getConfiguration());
            configuration.setLocales(new android.os.LocaleList(java.util.Locale.forLanguageTag(locale)));return request.activity.createConfigurationContext(configuration);}
        private String label(int resource){return localeContext().getString(resource);}
        private int dp(int value){return Math.round(value*request.activity.getResources().getDisplayMetrics().density);}
        private static void clear(android.view.View view){view.setSaveEnabled(false);view.setOnClickListener(null);view.setEnabled(false);
            if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++)clear(group.getChildAt(i));}}
        private android.widget.TextView text(android.content.Context context,int size){android.widget.TextView view=new android.widget.TextView(context);view.setSaveEnabled(false);view.setTextSize(size);view.setTextColor(0xffedf2fa);return view;}
        private android.widget.Button button(android.content.Context context,String label,Runnable body){android.widget.Button button=new android.widget.Button(context);button.setText(label);button.setSaveEnabled(false);
            button.setFilterTouchesWhenObscured(true);button.setOnTouchListener((v,event)->{if((event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){inputCancel();return true;}return false;});
            button.setOnClickListener(view->{try{live();require(dialog!=null&&shown&&dialog.isShowing()&&dialog.getWindow()!=null
                    &&dialog.getWindow().getAttributes().token==request.token&&dialog.getWindow().getDecorView().hasWindowFocus()
                    &&request.activity.getWindow().getDecorView().getWindowToken()==request.token);body.run();}catch(Exception denied){inputCancel();}});return button;}
        private void input() throws Exception {
            originalReadback();phase=LocalV2PinPhase.input;writer.onMain(request,this::presentInput,false);
            for(;;){synchronized(writer){if(ready||cancelled||request.cancelled)break;writer.wait(25);}try{live();}catch(Exception failure){inputCancel();}}
            cleanupInput();live();require(ready&&entered!=null&&entered.length>0&&uiJoined);
        }
        private void presentInput(){try{live();android.content.Context ui=localeContext();dialog=new android.app.Dialog(request.activity);dialog.setCancelable(true);dialog.setCanceledOnTouchOutside(false);
                android.widget.LinearLayout content=new android.widget.LinearLayout(ui);content.setOrientation(android.widget.LinearLayout.VERTICAL);content.setPadding(dp(16),dp(16),dp(16),dp(16));content.setSaveEnabled(false);
                dialog.setOwnerActivity(request.activity);content.setFilterTouchesWhenObscured(true);if(android.os.Build.VERSION.SDK_INT>=26)content.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                android.graphics.drawable.GradientDrawable panel=new android.graphics.drawable.GradientDrawable();panel.setColor(0xff101827);panel.setCornerRadius(dp(22));content.setBackground(panel);
                android.widget.TextView title=text(ui,22);title.setText(label(R.string.native_pin_title));content.addView(title);
                if(gate!=null){android.widget.TextView actionLabel=text(ui,14);actionLabel.setText(label(PinVerificationNativeInput.actionResource(gate.action)));content.addView(actionLabel);}
                subtitle=text(ui,16);content.addView(subtitle);mask=text(ui,26);mask.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);content.addView(mask);count=text(ui,14);content.addView(count);
                keypad=new android.widget.LinearLayout(ui);keypad.setOrientation(android.widget.LinearLayout.VERTICAL);content.addView(keypad);
                for(int[] row:new int[][]{{1,2,3},{4,5,6},{7,8,9}}){android.widget.LinearLayout line=new android.widget.LinearLayout(ui);for(int digit:row)line.addView(button(ui,Integer.toString(digit),()->digit(digit)),new android.widget.LinearLayout.LayoutParams(0,dp(56),1));keypad.addView(line);}
                android.widget.LinearLayout bottom=new android.widget.LinearLayout(ui);bottom.addView(button(ui,label(R.string.native_pin_delete),this::backspace),new android.widget.LinearLayout.LayoutParams(0,dp(56),1));
                bottom.addView(button(ui,"0",()->digit(0)),new android.widget.LinearLayout.LayoutParams(0,dp(56),1));bottom.addView(button(ui,label(R.string.native_pin_cancel),this::inputCancel),new android.widget.LinearLayout.LayoutParams(0,dp(56),1));keypad.addView(bottom);
                next=button(ui,label(R.string.native_pin_continue),this::acceptInput);content.addView(next);android.widget.ScrollView scroll=new android.widget.ScrollView(ui){public boolean onFilterTouchEventForSecurity(android.view.MotionEvent event){
                    if((event.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){inputCancel();return false;}return super.onFilterTouchEventForSecurity(event);}};
                scroll.setSaveEnabled(false);scroll.setFilterTouchesWhenObscured(true);scroll.addView(content);dialog.setContentView(scroll);require(dialog.getWindow()!=null);
                dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);dialog.getWindow().getAttributes().token=request.token;
                dialog.getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);dialog.setOnCancelListener(d->inputCancel());
                dialog.setOnDismissListener(d->{synchronized(writer){request.events++;}try{synchronized(writer){if(!ready)cancelled=true;shown=false;uiJoined=true;}}
                    finally{synchronized(writer){request.events--;writer.notifyAll();}}});
                accepting=true;render();dialog.show();shown=true;dialog.getWindow().setLayout(Math.min(dp(360),request.activity.getResources().getDisplayMetrics().widthPixels-dp(32)),Math.min(dp(680),request.activity.getResources().getDisplayMetrics().heightPixels-dp(64)));
                focusObserver=focused->{if(focused)everFocused=true;else if(everFocused&&shown)inputCancel();};dialog.getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(focusObserver);
                everFocused=dialog.getWindow().getDecorView().hasWindowFocus();
            }catch(Exception failure){inputCancel();}}
        private void digit(int value){synchronized(writer){if(!accepting||cancelled||length>=128||value<0||value>9)return;edit[length++]=(byte)(48+value);}render();}
        private void backspace(){synchronized(writer){if(!accepting||cancelled||length==0)return;edit[--length]=0;}render();}
        private void render(){int amount,current;synchronized(writer){amount=length;current=stage;}subtitle.setText(label(kind==LocalV2PinKind.verify?R.string.native_pin_verify_prompt:current==0?R.string.native_pin_fresh:R.string.native_pin_confirmation));
            char[] bullets=new char[Math.min(amount,12)];Arrays.fill(bullets,'\u2022');mask.setText(new String(bullets));Arrays.fill(bullets,'\0');count.setText(localeContext().getString(R.string.native_pin_count,amount));next.setEnabled(amount>=(kind==LocalV2PinKind.enroll?4:1)&&amount<=128);}
        private void acceptInput(){synchronized(writer){if(!accepting||cancelled||length<(kind==LocalV2PinKind.enroll?4:1))return;
                if(kind==LocalV2PinKind.enroll&&stage==0){first=Arrays.copyOf(edit,length);LocalSnapshotV2.wipe(edit);length=0;stage=1;}
                else{byte[] candidate=Arrays.copyOf(edit,length);LocalSnapshotV2.wipe(edit);length=0;if(kind==LocalV2PinKind.enroll&&!MessageDigest.isEqual(first,candidate)){
                        LocalSnapshotV2.wipe(first);LocalSnapshotV2.wipe(candidate);first=null;stage=0;subtitle.announceForAccessibility(label(R.string.native_pin_mismatch));}
                    else{entered=candidate;ready=true;accepting=false;writer.notifyAll();}}}if(!ready)render();}
        private void inputCancel(){synchronized(writer){if(finished||request.detached||writer.active!=request)return;cancelled=true;accepting=false;LocalSnapshotV2.wipe(edit);length=0;writer.notifyAll();}revoke();}
        private void cleanupInput() throws Exception {
            writer.onMain(request,()->{accepting=false;LocalSnapshotV2.wipe(edit);length=0;if(mask!=null)mask.setText("");if(count!=null)count.setText("");if(keypad!=null)clear(keypad);if(next!=null)clear(next);
                if(dialog!=null){dialog.setOnCancelListener(null);if(focusObserver!=null&&dialog.getWindow()!=null){android.view.ViewTreeObserver observer=dialog.getWindow().getDecorView().getViewTreeObserver();
                        if(observer.isAlive())observer.removeOnWindowFocusChangeListener(focusObserver);focusObserver=null;}if(shown)dialog.dismiss();else uiJoined=true;}
                else uiJoined=true;},true);
            synchronized(writer){while(!uiJoined||request.mainCalls>0||request.events>0)writer.wait(10);}
            // OnDismiss can be an accepted queued main callback. Only detach
            // references after that original callback actually returned.
            writer.onMain(request,()->{if(dialog!=null)dialog.setOnDismissListener(null);dialog=null;subtitle=null;mask=null;count=null;next=null;keypad=null;},true);
        }
        private static String hex(byte[] bytes){StringBuilder out=new StringBuilder(bytes.length*2);for(byte b:bytes){out.append("0123456789abcdef".charAt((b>>>4)&15));out.append("0123456789abcdef".charAt(b&15));}return out.toString();}
        private byte[] enrolled(byte[] salt,byte[] credential,byte[] hash) throws Exception {
            byte[] seed=enrollment.copySeed();try{String old=new String(seed,StandardCharsets.UTF_8);String pin="{\"schemaVersion\":1,\"policyVersion\":"+LocalSnapshotV2.quoted(request.policy.version)
                    +",\"revision\":1,\"credentialId\":"+LocalSnapshotV2.quoted(hex(credential))+",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":"+iterations
                    +",\"saltHex\":"+LocalSnapshotV2.quoted(hex(salt))+",\"hashHex\":"+LocalSnapshotV2.quoted(hex(hash))+"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":"+enrollment.logicalMs+",\"pendingAttemptId\":null}}";
                byte[] protectedBytes=old.replaceFirst("\\\"revision\\\":1","\"revision\":2").replace("\"pin\":null","\"pin\":"+pin).getBytes(StandardCharsets.UTF_8);
                try{return LocalSnapshotV2.wire(protectedBytes,request.policy,1,2,1,hex(credential),0,null,0,enrollment.logicalMs);}finally{LocalSnapshotV2.wipe(protectedBytes);}
            }finally{LocalSnapshotV2.wipe(seed);}
        }
        private void calibration(RealPinPrimitivePlatform platform) throws Exception {
            byte[] dummy=new byte[128],salt=new byte[32],hash=new byte[32];long previous=-1;
            try{for(int sample=0;sample<3;sample++){originalReadback();platform.random(dummy);for(int i=0;i<dummy.length;i++)dummy[i]=(byte)(48+((dummy[i]&255)%10));platform.random(salt);
                    long before=platform.continuousNanos();require(before>=0&&before>=previous);platform.derive(dummy,salt,iterations,hash,this::live);
                    long after=platform.continuousNanos();require(after>before&&after-before<=5000000000L);previous=after;live();LocalSnapshotV2.wipe(dummy);LocalSnapshotV2.wipe(salt);LocalSnapshotV2.wipe(hash);}}
            finally{LocalSnapshotV2.wipe(dummy);LocalSnapshotV2.wipe(salt);LocalSnapshotV2.wipe(hash);}
        }
        private void enroll() throws Exception {
            owner();RealPinPrimitivePlatform platform=new RealPinPrimitivePlatform();calibration(platform);input();phase=LocalV2PinPhase.deriving;byte[] salt=new byte[32],credential=new byte[32],hash=new byte[32],nextBytes=null;
            try{platform.random(salt);platform.random(credential);require(PinNativePrimitives.nonzero(salt)&&PinNativePrimitives.nonzero(credential));
                originalReadback();platform.derive(entered,salt,iterations,hash,this::live);live();require(PinNativePrimitives.nonzero(hash));platformEnrolled=true;nextBytes=enrolled(salt,credential,hash);
                ownerNextChecksum=digest(nextBytes);signing.update(payload);signing.update(ownerNextChecksum.getBytes(StandardCharsets.US_ASCII));signature=signing.sign();verifyOwner();ownerConsumed=true;enrollmentCandidate=nextBytes;
                phase=LocalV2PinPhase.finalizing;LocalV2StorageReceipt receipt=writer.enroll(request,enrollment,nextBytes);String finalChecksum=receipt.checksum;writer.acknowledge(receipt);finalAcknowledged=true;
                reply=new LocalV2PinReply(this,null,finalChecksum);
            }finally{LocalSnapshotV2.wipe(salt);LocalSnapshotV2.wipe(credential);LocalSnapshotV2.wipe(hash);LocalSnapshotV2.wipe(nextBytes);enrollmentCandidate=null;}
        }
        private void verify() throws Exception {
            input();live();require(entered.length>0&&entered.length<=128);phase=LocalV2PinPhase.charging;LocalV2StorageReceipt charge=writer.charge(request);writer.acknowledge(charge);
            LocalV2ChargedReservation reservation=request.reservation;require(reservation!=null&&!reservation.closed);byte[] charged=reservation.charged.clone();
            PinVerificationOutcome result=PinVerificationOutcome.mismatch;
            try(LocalSnapshotV2 record=LocalSnapshotV2.decode(charged,request.policy)){
                require(record.pendingAttemptId.equals(reservation.attemptId));LocalV2PinVerifier pin=verifier(record);phase=LocalV2PinPhase.comparing;
                writer.exactCharged(this,reservation);result=pin.compare(entered.clone(),()->{live();writer.exactCharged(this,reservation);});live();
                // Malformed NONEMPTY native bytes are an actual mismatch only
                // after durable original charge/ACK. They retain count/debt.
                platformCompared=true;comparison=new LocalV2PinComparison(this,reservation,result,charged);phase=LocalV2PinPhase.finalizing;
                LocalV2StorageReceipt finalization=writer.finalizeAttempt(this,comparison);String finalChecksum=finalization.checksum;writer.acknowledge(finalization);finalAcknowledged=true;
                reply=new LocalV2PinReply(this,result,finalChecksum);
            }finally{LocalSnapshotV2.wipe(charged);if(comparison!=null)comparison.close();}
        }
        private void run(LocalV2PinRecipient recipient){try{live();if(kind==LocalV2PinKind.enroll)enroll();else verify();live();phase=LocalV2PinPhase.delivering;
                synchronized(writer){deliveryEntered=true;recipients++;}try{recipient.completed(reply);live();delivered=true;}finally{synchronized(writer){recipients--;writer.notifyAll();}}
            }catch(Throwable failure){synchronized(writer){cancelled=true;if(reply!=null)reply.close();}if(!(failure instanceof PinKnownRefusal)||request.unacknowledgedMutation||deliveryEntered)writer.unknown(request);
                revoke();if(!deliveryEntered){synchronized(writer){deliveryEntered=true;recipients++;}try{recipient.completed(null);}catch(Throwable uncertain){writer.unknown(request);}
                    finally{synchronized(writer){recipients--;writer.notifyAll();}}}}
            finally{try{revokeIfCancelled();}catch(Throwable failure){writer.unknown(request);}try{cleanupInput();}catch(Throwable failure){writer.unknown(request);}
                try{joinCancel();}catch(Throwable failure){writer.unknown(request);}joinPrompt();
                boolean interrupted=false;synchronized(writer){while(!uiJoined||request.mainCalls>0){try{writer.wait();}catch(InterruptedException ignored){interrupted=true;}}}if(interrupted)Thread.currentThread().interrupt();
                LocalSnapshotV2.wipe(edit);LocalSnapshotV2.wipe(first);LocalSnapshotV2.wipe(entered);
                LocalSnapshotV2.wipe(signature);LocalSnapshotV2.wipe(keyEncoding);synchronized(writer){phase=LocalV2PinPhase.finished;finished=true;request.pinWorkers--;writer.wipeIdle(request);writer.notifyAll();}}
        }
        private void revokeIfCancelled(){if(cancelled||request.cancelled)revoke();}
        private void settle(LocalV2PinReply original,PinReplyDelivery delivery) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()&&worker!=Thread.currentThread()&&original!=null&&original.operation==this&&delivery!=null);
            worker.join();joinCancel();synchronized(writer){writer.own(request);require(reply==original&&!original.settled&&finished&&recipients==0&&request.pinWorkers==0&&request.pinCancelCalls==0
                &&request.workers==0&&request.mainCalls==0&&request.events==0&&request.settleCalls==0&&request.receipt==null&&!request.unacknowledgedMutation);
                if(delivery==PinReplyDelivery.known){live();require(delivered&&!original.disposed&&finalAcknowledged&&uiJoined&&(kind==LocalV2PinKind.enroll?ownerConsumed&&platformEnrolled:platformCompared));}
                else{writer.unknown(request);original.close();}original.settled=true;}
            boolean retain=delivery==PinReplyDelivery.known&&kind==LocalV2PinKind.verify&&original.outcome==PinVerificationOutcome.match;
            try{if(retain)closedObservers(true);writer.retire(request);synchronized(writer){knownSettlement=delivery==PinReplyDelivery.known&&!closedRevoked;phase=LocalV2PinPhase.closed;wipeOriginal();}}
            catch(Throwable failure){closedRevoked=true;try{closedObservers(false);}catch(Throwable cleanup){failure.addSuppressed(cleanup);}throw failure;}
        }
        private void wipeOriginal(){LocalSnapshotV2.wipe(original);LocalSnapshotV2.wipe(nonce);LocalSnapshotV2.wipe(payload);}
    }

    /** Saved canonical LOCAL v2 context. No caller supplies child identity,
     * route/profile revisions, language, policy or a comparison result. */
    private static final class LocalV2GateScope {
        final PinGateContext context;final String locale,registryChecksum,protectedChecksum,credential;
        final long rootRevision,pinRevision;
        private LocalV2GateScope(LocalSnapshotV2 snapshot) throws Exception {
            byte[] raw=snapshot.copy();try{
                ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,snapshot.protectedStart,snapshot.protectedEnd-snapshot.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);rootRevision=p.number(1,MAX_SAFE);
                p.field("mode",false);require("child".equals(p.string()));p.field("selectionRevision",false);long selection=p.number(1,MAX_SAFE);
                p.field("profileRevision",false);long revision=p.number(1,MAX_SAFE);p.field("policyChecksum",false);require(p.string().equals(snapshot.policy.checksum));
                p.field("registryChecksum",false);registryChecksum=p.string();p.field("registry",false);int registryStart=p.index;
                String active=ProtectedEnvelope.registry(p,snapshot.policy.version);require(active!=null);
                ProtectedEnvelope.Cursor r=new ProtectedEnvelope.Cursor(p.text.substring(registryStart,p.index));
                r.field("schemaVersion",true);r.number(1,1);r.field("policyVersion",false);require(r.string().equals(snapshot.policy.version));
                r.field("activeProfileId",false);require(active.equals(r.string()));r.field("profiles",false);r.token("[");String selectedLocale=null;
                do {int start=r.index;String profile=ProtectedEnvelope.profile(r);if(profile.equals(active)){
                    ProtectedEnvelope.Cursor selected=new ProtectedEnvelope.Cursor(r.text.substring(start,r.index));selected.field("id",true);selected.string();
                    selected.field("label",false);selected.string();selected.field("exactAge",false);selected.number(3,17);selected.field("ageBand",false);selected.string();
                    selected.field("locale",false);selectedLocale=selected.string();}}
                while(r.take(","));r.token("]");r.token("}");require("ru".equals(selectedLocale)||"en".equals(selectedLocale));
                locale=selectedLocale;context=new PinGateContext(active,snapshot.policy.version,revision,selection,"child","active");
                protectedChecksum=snapshot.protectedChecksum;credential=snapshot.credentialId;pinRevision=snapshot.pinRevision;
            }finally{LocalSnapshotV2.wipe(raw);}
        }
        private void initial(LocalSnapshotV2 current) throws Exception {
            require(current.revision==rootRevision&&current.pinRevision==pinRevision&&current.protectedChecksum.equals(protectedChecksum));same(current);
        }
        private void same(LocalSnapshotV2 current) throws Exception {
            LocalV2GateScope actual=new LocalV2GateScope(current);require(context.profileId.equals(actual.context.profileId)
                &&context.policyVersion.equals(actual.context.policyVersion)&&context.profileRevision==actual.context.profileRevision
                &&context.routeRevision==actual.context.routeRevision&&registryChecksum.equals(actual.registryChecksum)
                &&locale.equals(actual.locale)&&credential.equals(actual.credential));
        }
    }
    /** One native button invocation. The request token is this exact object;
     * target bytes are owned before native capture. No public capability is
     * exposed and no bare boolean can enter the transfer boundary. */
    private static final class LocalV2GateInvocation {
        final String id,action,targetChecksum;final long generation,began,deadline;private final byte[] target;
        private PinGateRequest original;private LocalV2GateScope scope;private boolean spent,revoked;private long last;
        private LocalV2GateInvocation(String action,byte[] target,long generation,long began,long verificationMs,long capabilityMs) throws Exception {
            require(target!=null&&target.length<=MAX_BYTES&&generation>=0&&generation<=MAX_SAFE&&began>=0&&began<=MAX_SAFE
                &&verificationMs>0&&verificationMs<=60000&&capabilityMs>0&&capabilityMs<=2147483647L);
            long duration=Math.min(verificationMs,capabilityMs);require(began<=MAX_SAFE-duration);
            this.action=action;this.target=target.clone();targetChecksum=digest(this.target);this.generation=generation;this.began=began;last=began;deadline=began+duration;
            byte[] nonce=new byte[32];try{new java.security.SecureRandom().nextBytes(nonce);id=LocalV2PinOperation.hex(nonce);}finally{LocalSnapshotV2.wipe(nonce);}
        }
        private synchronized void live(long now) throws Exception {if(spent||revoked||now<last||now>=deadline){revoked=true;throw new PinKnownRefusal();}last=now;}
        private synchronized PinGateRequest capture(LocalV2GateScope exact,long now) throws Exception {
            live(now);require(scope==null&&original==null&&exact!=null);scope=exact;original=new PinGateRequest(this,id,action,targetChecksum,exact.context,generation,deadline);return original;
        }
        private synchronized byte[] transfer(LocalV2PinReply reply,long now) throws Exception {
            // All attempts spend before inspecting proof; an invalid or late
            // transfer cannot be retried using a subsequently repaired fact.
            boolean available=!spent&&!revoked&&now>=last&&now<deadline;spent=true;if(available)last=now;
            require(available&&original!=null&&reply!=null&&reply.gate==original&&reply.kind==LocalV2PinKind.verify
                &&reply.operation.originalChallenge==this&&reply.operation.gate==original&&reply.operation.knownSettlement
                &&reply.settled&&reply.consumed&&!reply.disposed&&!reply.operation.closedRevoked
                &&reply.outcome==PinVerificationOutcome.match&&reply.operation.request.retired&&reply.operation.request.detached
                &&reply.operation.finalAcknowledged&&reply.operation.platformCompared&&digest(target).equals(targetChecksum));
            return target.clone();
        }
        private synchronized void revoke(){revoked=true;}
        private synchronized void close(){spent=true;LocalSnapshotV2.wipe(target);}
    }
    private interface LocalV2NativeProtectedAction {void perform(String originalAction,byte[] originalTarget) throws Exception;}
    /** Private usable native-control host. Native route ownership is the
     * original non-WebView route root and Button ancestry, not JS route claims.
     * App/admitted AES integration must still select no production factory. */
    private static final class LocalV2GateHost implements AutoCloseable {
        final LocalV2Writer writer;final LocalSnapshotV2Policy policy;final android.app.Activity activity;
        final android.view.ViewGroup route;final android.widget.Button control;final android.os.IBinder window;
        final String action;final long verificationMs,capabilityMs;final LocalV2NativeProtectedAction dispatch;
        private final byte[] target;private final android.view.ViewParent[] ancestry;
        private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
        private volatile LocalV2GateInvocation invocation;private volatile LocalV2Request request;private volatile LocalV2PinOperation operation;
        private volatile boolean closed,revoked;private long generation;private Thread worker;
        private android.app.Application.ActivityLifecycleCallbacks lifecycle;private android.content.BroadcastReceiver screen;
        private androidx.activity.OnBackPressedCallback back;private android.view.View.OnAttachStateChangeListener attachment;
        private android.view.ViewTreeObserver.OnWindowFocusChangeListener focus;private android.view.ViewTreeObserver.OnGlobalLayoutListener layout;private Runnable expiry;
        private LocalV2GateHost(PlanetChildVault vault,android.app.Activity host,android.view.ViewGroup route,android.widget.Button control,
            LocalSnapshotV2Policy policy,String action,byte[] target,long verificationMs,long capabilityMs,LocalV2NativeProtectedAction dispatch) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&vault!=null&&host!=null&&host.getClass()==MainActivity.class
                &&host.getApplicationContext()==vault.context&&route!=null&&control!=null&&dispatch!=null&&policy!=null&&target!=null
                &&target.length<=MAX_BYTES&&verificationMs>0&&verificationMs<=60000&&capabilityMs>0&&capabilityMs<=2147483647L
                &&!(route instanceof android.webkit.WebView)&&route!=host.getWindow().getDecorView()&&!control.hasOnClickListeners());
            activity=host;this.route=route;this.control=control;this.policy=new LocalSnapshotV2Policy(policy.version,policy.checksum,policy.maximumIterations,policy.delays);
            this.action=action;this.target=target.clone();this.verificationMs=verificationMs;this.capabilityMs=capabilityMs;this.dispatch=dispatch;
            window=host.getWindow().getDecorView().getWindowToken();require(window!=null&&host.hasWindowFocus());writer=new LocalV2Writer(vault);
            java.util.ArrayList<android.view.ViewParent> parents=new java.util.ArrayList<>();android.view.ViewParent parent=control.getParent();
            while(parent!=null){parents.add(parent);if(parent==route)break;parent=parent.getParent();}require(!parents.isEmpty()&&parents.get(parents.size()-1)==route);
            ancestry=parents.toArray(new android.view.ViewParent[0]);current(false);
            // Validate the fixed existing sixteen-action vocabulary now, before
            // a button is hooked. This temporary value never authorizes work.
            new PinGateRequest(new Object(),LocalV2PinOperation.hex(new byte[32]),action,digest(this.target),new PinGateContext("native-validation",policy.version,1,0,"child","active"),0,1);
            try{attach();control.setOnClickListener(v->begin());}catch(Throwable failure){revoke();detach();LocalSnapshotV2.wipe(this.target);throw failure;}
        }
        private boolean ownedInput(){LocalV2PinOperation original=operation;return original!=null&&original.request==request&&original.kind==LocalV2PinKind.verify
            &&original.dialog!=null&&original.dialog.isShowing()&&original.dialog.getWindow()!=null
            &&original.dialog.getWindow().getAttributes().token==window&&original.dialog.getWindow().getDecorView().hasWindowFocus();}
        private void current(boolean allowInput) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());if(closed||revoked||activity.isFinishing()||activity.isDestroyed()
                ||activity.getWindow().getDecorView().getWindowToken()!=window||route.getRootView()!=activity.getWindow().getDecorView()
                ||route.getWindowToken()!=window||!route.isShown()||!control.isShown())throw new PinKnownRefusal();
            android.view.ViewParent parent=control.getParent();for(android.view.ViewParent exact:ancestry){require(parent==exact);parent=parent.getParent();}
            require(activity.hasWindowFocus()||allowInput&&ownedInput());LocalV2GateInvocation original=invocation;if(original!=null)original.live(SystemClock.elapsedRealtime());
        }
        private void attach() throws Exception {
            lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}
                public void onActivityStarted(android.app.Activity a){}public void onActivityResumed(android.app.Activity a){}
                public void onActivityPaused(android.app.Activity a){if(a==activity)revoke();}public void onActivityStopped(android.app.Activity a){if(a==activity)revoke();}
                public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}public void onActivityDestroyed(android.app.Activity a){if(a==activity)revoke();}};
            ((android.app.Application)writer.vault.context).registerActivityLifecycleCallbacks(lifecycle);
            screen=new android.content.BroadcastReceiver(){public void onReceive(Context c,android.content.Intent i){revoke();}};
            android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
            if(android.os.Build.VERSION.SDK_INT>=33)writer.vault.context.registerReceiver(screen,filter,Context.RECEIVER_NOT_EXPORTED);else writer.vault.context.registerReceiver(screen,filter);
            back=new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){revoke();setEnabled(false);((MainActivity)activity).getOnBackPressedDispatcher().onBackPressed();}};
            ((MainActivity)activity).getOnBackPressedDispatcher().addCallback((MainActivity)activity,back);
            attachment=new android.view.View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(android.view.View v){}public void onViewDetachedFromWindow(android.view.View v){revoke();}};
            route.addOnAttachStateChangeListener(attachment);control.addOnAttachStateChangeListener(attachment);
            focus=focused->{if(!focused)main.post(()->{try{current(true);}catch(Exception failure){revoke();}});};
            layout=()->{try{current(true);}catch(Exception failure){revoke();}};
            route.getViewTreeObserver().addOnWindowFocusChangeListener(focus);route.getViewTreeObserver().addOnGlobalLayoutListener(layout);
        }
        /** Called by the owning native router BEFORE reusing this route view. */
        private void routeWillChange(){revoke();}
        private void revoke(){revoked=true;LocalV2GateInvocation original=invocation;if(original!=null)original.revoke();
            LocalV2Request nativeRequest=request;if(nativeRequest!=null&&!nativeRequest.retired)try{writer.cancel(nativeRequest);}catch(Exception failure){writer.unknown(nativeRequest);}}
        private void onMain(java.util.concurrent.Callable<Void> body) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());java.util.concurrent.FutureTask<Void> task=new java.util.concurrent.FutureTask<>(body);
            require(main.post(task));boolean interrupted=false;try{for(;;)try{task.get();break;}catch(InterruptedException ignored){interrupted=true;}}
            finally{if(interrupted)Thread.currentThread().interrupt();}
        }
        private void begin(){try{current(false);require(invocation==null&&worker==null&&generation<MAX_SAFE);generation++;
                LocalV2GateInvocation original=new LocalV2GateInvocation(action,target,generation,SystemClock.elapsedRealtime(),verificationMs,capabilityMs);invocation=original;
                expiry=this::revoke;require(main.postDelayed(expiry,Math.max(1,original.deadline-SystemClock.elapsedRealtime())));
                worker=new Thread(()->run(original),"planet-local-v2-native-gate");try{worker.start();}catch(Throwable failure){if(worker.getState()==Thread.State.NEW)worker=null;throw failure;}
            }catch(Throwable failure){revoke();if(worker==null){try{detach();}catch(Throwable ignored){}closed=true;LocalSnapshotV2.wipe(target);}}}
        private void run(LocalV2GateInvocation original){LocalV2PinReply[] delivered={null};boolean retired=false;
            try{onMain(()->{current(false);return null;});LocalV2GateScope scope=writer.vault.locked(directory->{original.live(SystemClock.elapsedRealtime());writer.completeRecord(directory);
                    byte[] bytes=writer.vault.readExact(directory);try(LocalSnapshotV2 snapshot=LocalSnapshotV2.decode(bytes,policy)){return new LocalV2GateScope(snapshot);}finally{LocalSnapshotV2.wipe(bytes);}});
                PinGateRequest gate=original.capture(scope,SystemClock.elapsedRealtime());onMain(()->{current(false);request=writer.gateRequest(activity,policy,gate);return null;});
                operation=writer.verificationOperation(request,gate,scope.locale);try(LocalSnapshotV2 snapshot=LocalSnapshotV2.decode(operation.original,policy)){scope.initial(snapshot);}
                onMain(()->{current(false);return null;});operation.start(reply->{original.live(SystemClock.elapsedRealtime());require(reply!=null&&reply.operation==operation&&reply.gate==gate);delivered[0]=reply;});
                operation.worker.join();operation.joinCancel();LocalV2PinReply reply=delivered[0];require(reply!=null);original.live(SystemClock.elapsedRealtime());
                operation.settle(reply,PinReplyDelivery.known);retired=true;original.live(SystemClock.elapsedRealtime());require(reply.consume(gate)==PinVerificationOutcome.match);
                // The final exact canonical read remains scoped to the same
                // native operation after all original workers/recipients join.
                try{writer.vault.locked(directory->{original.live(SystemClock.elapsedRealtime());writer.completeRecord(directory);byte[] bytes=writer.vault.readExact(directory);
                    try(LocalSnapshotV2 snapshot=LocalSnapshotV2.decode(bytes,policy)){require(snapshot.checksum.equals(reply.checksum));scope.same(snapshot);
                        request.processClock.closedReadback(request.processLease,reply.checksum);return null;}finally{LocalSnapshotV2.wipe(bytes);}});}
                catch(Throwable failure){if(!(failure instanceof PinKnownRefusal))synchronized(request.processClock){
                        if(request.processClock.active==null&&request.processClock.pending==null&&request.processClock.known!=null&&request.processClock.known.checksum.equals(reply.checksum))request.processClock.invalidateLocked();}
                    throw failure;}
                onMain(()->{current(false);require(invocation==original&&operation.gate==gate);request.processClock.closedReadback(request.processLease,reply.checksum);
                    byte[] payload=original.transfer(reply,SystemClock.elapsedRealtime());
                    try{dispatch.perform(original.action,payload);}finally{LocalSnapshotV2.wipe(payload);}return null;});
            }catch(Throwable failure){revoke();}
            finally{if(request!=null&&!retired&&!request.retired){try{writer.cancel(request);if(operation!=null&&operation.worker!=null){operation.worker.join();operation.joinCancel();}
                        LocalV2PinReply reply=delivered[0];if(reply!=null&&!reply.settled)operation.settle(reply,PinReplyDelivery.uncertain);else writer.retire(request);
                    }catch(Throwable ignored){writer.unknown(request);}}
                if(operation!=null&&operation.closedLifecycle!=null)try{operation.closedObservers(false);}catch(Throwable ignored){revoke();}
                try{onMain(()->{detach();closed=true;original.close();LocalSnapshotV2.wipe(target);return null;});}catch(Throwable ignored){revoke();original.close();LocalSnapshotV2.wipe(target);}}
        }
        private void detach() throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());control.setOnClickListener(null);
            try{if(lifecycle!=null)((android.app.Application)writer.vault.context).unregisterActivityLifecycleCallbacks(lifecycle);}
            finally{try{if(screen!=null)writer.vault.context.unregisterReceiver(screen);}
                finally{try{if(back!=null)back.remove();if(attachment!=null){route.removeOnAttachStateChangeListener(attachment);control.removeOnAttachStateChangeListener(attachment);}}
                    finally{android.view.ViewTreeObserver observer=route.getViewTreeObserver();if(observer.isAlive()){if(focus!=null)observer.removeOnWindowFocusChangeListener(focus);if(layout!=null)observer.removeOnGlobalLayoutListener(layout);}
                        if(expiry!=null)main.removeCallbacks(expiry);}}}
            lifecycle=null;screen=null;back=null;attachment=null;focus=null;layout=null;expiry=null;
        }
        public void close() throws Exception {require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());revoke();
            // Active original joins keep the binding retained; close cannot
            // manufacture retirement or expose capacity to a new invocation.
            if(worker==null){detach();closed=true;LocalSnapshotV2.wipe(target);}}
    }
    /** Structural first-profile transition only. Its output never grants a
     * mutation: the fresh native owner producer below must sign/consume it. */
    private static final class LocalV2InitialProfile {
        private static String profileId(byte[] profile) throws Exception {
            require(profile!=null&&profile.length>0&&profile.length<=65536);
            String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(profile)).toString();
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(text);String id=ProtectedEnvelope.profile(p);require(p.index==text.length());return id;
        }
        private static byte[] create(LocalSnapshotV2 before,byte[] profile) throws Exception {
            String id=profileId(profile);byte[] raw=before.copy(),registry=null,protectedBytes=null;
            try{ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,before.protectedStart,before.protectedEnd-before.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);require(p.number(1,MAX_SAFE)==before.revision&&before.revision<MAX_SAFE);
                p.field("mode",false);require("adult".equals(p.string()));p.field("selectionRevision",false);long selection=p.number(1,MAX_SAFE);
                p.field("profileRevision",false);long revision=p.number(1,MAX_SAFE);require(selection==1&&revision==1);
                p.field("policyChecksum",false);require(p.string().equals(before.policy.checksum));p.field("registryChecksum",false);p.string();p.field("registry",false);int start=p.index;
                require(ProtectedEnvelope.registry(p,before.policy.version)==null);String empty="{\"schemaVersion\":1,\"policyVersion\":"+LocalSnapshotV2.quoted(before.policy.version)+",\"activeProfileId\":null,\"profiles\":[]}";
                require(p.text.substring(start,p.index).equals(empty)&&before.journalRevision<MAX_SAFE);
                registry=("{\"schemaVersion\":1,\"policyVersion\":"+LocalSnapshotV2.quoted(before.policy.version)+",\"activeProfileId\":"+LocalSnapshotV2.quoted(id)+",\"profiles\":["+new String(profile,StandardCharsets.UTF_8)+"]}").getBytes(StandardCharsets.UTF_8);
                String prefix="{\"schemaVersion\":2,\"revision\":"+(before.revision+1)+",\"mode\":\"child\",\"selectionRevision\":2,\"profileRevision\":2,\"policyChecksum\":"+LocalSnapshotV2.quoted(before.policy.checksum)
                    +",\"registryChecksum\":"+LocalSnapshotV2.quoted(digest(registry))+",\"registry\":"+new String(registry,StandardCharsets.UTF_8);
                // Exact original PIN and clock bytes, including pending count,
                // full debt and observed anchor, survive without any refund.
                protectedBytes=(prefix+",\"pin\":"+new String(raw,before.pinStart,before.protectedEnd-before.pinStart,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
                byte[] result=LocalSnapshotV2.wire(protectedBytes,before.policy,before.journalRevision+1,before.revision+1,before.pinRevision,before.credentialId,
                    before.count,before.pendingAttemptId,before.savedCooldownMs,before.lastObservedMs);
                try(LocalSnapshotV2 checked=LocalSnapshotV2.decode(result,before.policy)){}catch(Throwable failure){LocalSnapshotV2.wipe(result);throw failure;}return result;
            }finally{LocalSnapshotV2.wipe(raw);LocalSnapshotV2.wipe(registry);LocalSnapshotV2.wipe(protectedBytes);}
        }
        private static void validate(LocalSnapshotV2 before,LocalSnapshotV2 after) throws Exception {
            byte[] raw=after.copy(),profile=null,expected=null;
            try{ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,after.protectedStart,after.protectedEnd-after.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);p.number(1,MAX_SAFE);p.field("mode",false);require("child".equals(p.string()));
                p.field("selectionRevision",false);p.number(1,MAX_SAFE);p.field("profileRevision",false);p.number(1,MAX_SAFE);p.field("policyChecksum",false);p.string();p.field("registryChecksum",false);p.string();
                p.field("registry",false);p.field("schemaVersion",true);p.number(1,1);p.field("policyVersion",false);require(p.string().equals(before.policy.version));
                p.field("activeProfileId",false);String id=p.string();p.field("profiles",false);p.token("[");int start=p.index;require(ProtectedEnvelope.profile(p).equals(id));
                profile=p.text.substring(start,p.index).getBytes(StandardCharsets.UTF_8);p.token("]");p.token("}");expected=create(before,profile);
                require(before.policy.version.equals(after.policy.version)&&before.policy.checksum.equals(after.policy.checksum)&&before.policy.maximumIterations==after.policy.maximumIterations
                    &&Arrays.equals(before.policy.delays,after.policy.delays)&&MessageDigest.isEqual(expected,raw));
            }finally{LocalSnapshotV2.wipe(raw);LocalSnapshotV2.wipe(profile);LocalSnapshotV2.wipe(expected);}
        }
    }
    private enum LocalV2ProfilePhase { captured,confirming,owner,signed,dataPublishing,dataKnown,profilePublishing,profileKnown,closed,failed }
    /** Cross-file concrete birth permission. Only the actual fresh owner
     * operation below constructs it; neither P1 nor a caller boolean enters. */
    static final class LocalV2ProfileBirthPermit {
        private final LocalV2ProfileOperation original;
        private LocalV2ProfileBirthPermit(LocalV2ProfileOperation original){this.original=original;}
        private void exact(String identity,String nonce,String checksum) throws Exception {
            require(identity.equals(original.data.identity)&&nonce.equals(original.data.nonce)&&checksum.equals(original.data.checksum));original.boundary();
        }
        void consumeDataBirth(String identity,String nonce,String checksum) throws Exception {synchronized(original.writer){exact(identity,nonce,checksum);
            require(original.phase==LocalV2ProfilePhase.signed&&!original.dataSpent&&original.publicationThread==Thread.currentThread());original.dataSpent=true;original.phase=LocalV2ProfilePhase.dataPublishing;}}
        byte[] dataMarker(String identity,String nonce,String checksum) throws Exception {exact(identity,nonce,checksum);
            return ("LP-LOCAL-V2-DATA-BIRTH\n"+identity+"\n"+nonce+"\n"+checksum+"\n"+digest(original.payload)+"\n").getBytes(StandardCharsets.US_ASCII);}
        void dataBoundary(String identity,String nonce,String checksum) throws Exception {exact(identity,nonce,checksum);require(original.phase==LocalV2ProfilePhase.dataPublishing&&original.dataSpent);}
        void dataBirthKnown(String identity,String nonce,String checksum) throws Exception {exact(identity,nonce,checksum);synchronized(original.writer){require(original.phase==LocalV2ProfilePhase.dataPublishing);original.phase=LocalV2ProfilePhase.dataKnown;}}
        void dataReadback(String identity,String nonce,String checksum) throws Exception {exact(identity,nonce,checksum);
            require(original.phase==LocalV2ProfilePhase.dataKnown||original.phase==LocalV2ProfilePhase.profilePublishing||original.phase==LocalV2ProfilePhase.profileKnown||original.phase==LocalV2ProfilePhase.closed);}
        void dataBirthUnknown(){synchronized(original.writer){original.phase=LocalV2ProfilePhase.failed;original.writer.unknown(original.request);}}
    }
    /** Mutation result only, never child/content/package/Gate admission. */
    private static final class LocalV2ProfileCompletion {
        final String profileId,snapshotChecksum,dataChecksum;final long revision;
        private LocalV2ProfileCompletion(LocalV2ProfileOperation operation) throws Exception {
            require(operation.phase==LocalV2ProfilePhase.closed&&operation.delivered&&operation.request.retired&&operation.request.detached
                &&!operation.cancelled&&!operation.request.sealed&&!operation.worker.isAlive()&&operation.cancelWorker==null);
            profileId=LocalV2InitialProfile.profileId(operation.profile);snapshotChecksum=digest(operation.next);dataChecksum=operation.data.checksum;
            try(LocalSnapshotV2 record=LocalSnapshotV2.decode(operation.next,operation.request.policy)){revision=record.revision;}
        }
    }
    private interface LocalV2ProfileRecipient {void published(LocalV2ProfileOperation original) throws Exception;}
    /** Fresh original setup operation. Explicit complete profile proposals are
     * data only: native-generated ID, actual native confirmation and fresh
     * auth-per-use device-owner signature authorize the exact P2 transition. */
    private static final class LocalV2ProfileOperation {
        final LocalV2Writer writer;final LocalV2Request request;final String id,locale;private final byte[] profile,nonce;
        private byte[] before,next,payload,signature,keyEncoding;private String beforeChecksum;
        private java.security.Signature signing;private java.security.PublicKey publicKey;private android.hardware.biometrics.BiometricPrompt.CryptoObject crypto;
        private android.os.CancellationSignal signal;private volatile LocalV2ProfilePhase phase=LocalV2ProfilePhase.captured;
        private volatile boolean confirmed,uiJoined,promptOutstanding,ownerReturned,delivered,dataSpent,cancelled,cancelIssued,finished,completionConsumed;
        private Thread worker,settler,cancelWorker,publicationThread;private LocalV2ProfileCompletion completion;
        private PlanetChildDataStore.LocalV2BirthPlan data;private PlanetChildDataStore.LocalV2BirthReceipt birth;
        private final LocalV2ProfileBirthPermit permit;private android.app.Dialog dialog;
        private android.view.ViewTreeObserver.OnWindowFocusChangeListener focusObserver;private volatile boolean focusSeen,dismissing;
        private android.app.Application.ActivityLifecycleCallbacks closingLifecycle;private android.content.BroadcastReceiver closingScreen;private Runnable closingExpiry;
        private LocalV2ProfileOperation(LocalV2Writer writer,LocalV2Request request,byte[] proposal) throws Exception {
            require(writer!=null&&request!=null&&proposal!=null&&proposal.length>0&&proposal.length<=65536&&request.pinOperation==null&&request.profileOperation==null);
            this.writer=writer;this.request=request;LocalV2InitialProfile.profileId(proposal);String text=new String(proposal,StandardCharsets.UTF_8);
            nonce=new byte[32];new java.security.SecureRandom().nextBytes(nonce);id=LocalV2PinOperation.hex(nonce);
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(text);p.field("id",true);int from=p.index;p.string();int to=p.index;
            profile=(text.substring(0,from)+LocalSnapshotV2.quoted("child-"+id.substring(0,32))+text.substring(to)).getBytes(StandardCharsets.UTF_8);LocalV2InitialProfile.profileId(profile);
            locale=new org.json.JSONObject(new String(profile,StandardCharsets.UTF_8)).getString("locale");permit=new LocalV2ProfileBirthPermit(this);
            synchronized(writer){writer.live(request);request.profileOperation=this;request.processClock.claimPin(request.processLease,id,this);}
        }
        private static LocalV2ProfileOperation start(PlanetChildVault vault,android.app.Activity host,LocalSnapshotV2Policy policy,byte[] proposal,long timeout,LocalV2ProfileRecipient recipient) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&recipient!=null&&proposal!=null);byte[] owned=proposal.clone();LocalV2Writer writer=new LocalV2Writer(vault);
            LocalV2Request request=writer.request(host,policy,timeout);LocalV2ProfileOperation operation;
            try{operation=new LocalV2ProfileOperation(writer,request,owned);}catch(Throwable failure){writer.unknown(request);new Thread(()->{try{writer.retire(request);}catch(Exception ignored){}},"planet-profile-capture-cleanup").start();throw failure;}
            finally{LocalSnapshotV2.wipe(owned);}synchronized(writer){request.pinWorkers++;operation.worker=new Thread(()->operation.run(recipient),"planet-local-v2-profile");operation.worker.start();}
            operation.settler=new Thread(operation::settle,"planet-local-v2-profile-settle");operation.settler.start();return operation;
        }
        private void live() throws Exception {synchronized(writer){writer.live(request);require(request.profileOperation==this&&!cancelled&&!Thread.currentThread().isInterrupted());}}
        private void revoke(){synchronized(writer){cancelled=true;if(signal==null||cancelIssued||finished&&!promptOutstanding)return;cancelIssued=true;request.pinCancelCalls++;
            cancelWorker=new Thread(()->{try{signal.cancel();}catch(Throwable failure){writer.unknown(request);}finally{synchronized(writer){request.pinCancelCalls--;writer.notifyAll();}}},"planet-profile-owner-cancel");cancelWorker.start();writer.notifyAll();}}
        private boolean ownedOwnerPause(){return phase==LocalV2ProfilePhase.owner&&promptOutstanding&&!ownerReturned&&!cancelled&&!finished&&signal!=null&&crypto!=null&&crypto.getSignature()==signing;}
        private void joinCancel() throws Exception {Thread original;synchronized(writer){original=cancelWorker;}if(original!=null){original.join();synchronized(writer){require(request.pinCancelCalls==0);cancelWorker=null;}}}
        private static String confirmationValue(org.json.JSONObject profile,String field,boolean ru) throws Exception {
            if(!profile.has(field))return ru?"не задано":"not set";
            Object value=profile.get(field);
            if(value==org.json.JSONObject.NULL)return field.equals("allowedTopics")?(ru?"Все темы, кроме запрещённых":"All topics except blocked topics"):(ru?"не задано":"not set");
            if(value instanceof Boolean)return ((Boolean)value)?(ru?"Включено":"On"):(ru?"Выключено":"Off");
            if(value instanceof org.json.JSONArray){org.json.JSONArray topics=(org.json.JSONArray)value;if(topics.length()==0)return ru?"Нет":"None";
                java.util.ArrayList<String> names=new java.util.ArrayList<>();for(int i=0;i<topics.length();i++)names.add(topicText(topics.getString(i),ru));return android.text.TextUtils.join(", ",names);}
            String raw=String.valueOf(value);
            if(field.equals("locale"))return raw.equals("ru")?(ru?"Русский":"Russian"):(ru?"Английский":"English");
            if(field.equals("readingLevel")){if(raw.equals("plain"))return ru?"Простой текст":"Simple text";if(raw.equals("developing"))return ru?"Учится читать":"Developing reader";return ru?"Свободно читает":"Fluent reader";}
            if(field.equals("motion"))return raw.equals("calm")?(ru?"Спокойное движение":"Calm motion"):(ru?"Как в настройках устройства":"Use device settings");
            if(field.equals("ageConfirmedAt"))return raw.replace('T',' ').replace("Z"," UTC");
            return raw;
        }
        private static String topicText(String topic,boolean ru) throws Exception {
            String[][] names={{"nature","Природа","Nature"},{"horror","Ужасы","Horror"},{"adventure","Приключения","Adventure"},{"violence","Насилие","Violence"}};
            for(String[] item:names)if(item[0].equals(topic))return item[ru?1:2];
            throw new PinKnownRefusal(); // No inferred label may authorize an unknown topic.
        }
        private void confirm() throws Exception {
            phase=LocalV2ProfilePhase.confirming;writer.onMain(request,()->{try{live();dialog=new android.app.Dialog(request.activity);dialog.setCancelable(true);
                android.widget.LinearLayout content=new android.widget.LinearLayout(request.activity);content.setOrientation(1);content.setPadding(24,24,24,24);
                org.json.JSONObject p=new org.json.JSONObject(new String(profile,StandardCharsets.UTF_8));android.widget.TextView title=new android.widget.TextView(request.activity);
                title.setText("ru".equals(locale)?"Подтвердите первый локальный профиль и детский режим":"Confirm the first local profile and child mode");content.addView(title);
                String[][] fields={{"label","Имя","Label"},{"exactAge","Точный возраст","Exact age"},{"ageBand","Возрастная группа","Age band"},{"locale","Язык","Language"},{"ageConfirmedAt","Подтверждение возраста","Age confirmation"},
                    {"readingLevel","Уровень чтения","Reading level"},{"allowedTopics","Разрешённые темы","Allowed topics"},{"blockedTopics","Закрытые темы","Blocked topics"},{"soundEnabled","Звук","Sound"},{"motion","Движение","Motion"},{"narrationEnabled","Озвучивание","Narration"},{"localeLocked","Фиксация языка","Language lock"}};
                for(String[] field:fields){android.widget.TextView row=new android.widget.TextView(request.activity);row.setText(field["ru".equals(locale)?1:2]+": "+confirmationValue(p,field[0],"ru".equals(locale)));content.addView(row);}
                android.widget.Button accept=new android.widget.Button(request.activity);accept.setText("ru".equals(locale)?"Подтвердить профиль":"Confirm profile");accept.setFilterTouchesWhenObscured(true);
                accept.setOnClickListener(v->{synchronized(writer){try{live();require(phase==LocalV2ProfilePhase.confirming&&!confirmed&&dialog!=null&&dialog.isShowing()&&dialog.getWindow().getDecorView().hasWindowFocus());confirmed=true;writer.notifyAll();}catch(Exception failure){revoke();}}});content.addView(accept);android.widget.ScrollView scroll=new android.widget.ScrollView(request.activity){public boolean onFilterTouchEventForSecurity(android.view.MotionEvent e){
                    if((e.getFlags()&(android.view.MotionEvent.FLAG_WINDOW_IS_OBSCURED|android.view.MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))!=0){revoke();return false;}return super.onFilterTouchEventForSecurity(e);}};
                scroll.addView(content);dialog.setContentView(scroll);dialog.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);dialog.setOnCancelListener(v->revoke());
                dialog.setOnDismissListener(v->{synchronized(writer){uiJoined=true;if(!confirmed)cancelled=true;writer.notifyAll();}});dialog.show();
                focusSeen=dialog.getWindow().getDecorView().hasWindowFocus();focusObserver=focused->{if(focused)focusSeen=true;else if(focusSeen&&!dismissing&&phase==LocalV2ProfilePhase.confirming)revoke();};
                dialog.getWindow().getDecorView().getViewTreeObserver().addOnWindowFocusChangeListener(focusObserver);
            }catch(Exception failure){revoke();}},false);
            try{synchronized(writer){while(!confirmed&&!cancelled){writer.wait(25);live();}}}
            finally{writer.onMain(request,()->{if(dialog!=null){dismissing=true;boolean shown=dialog.isShowing();dialog.setOnCancelListener(null);dialog.dismiss();if(!shown)uiJoined=true;}else uiJoined=true;},true);synchronized(writer){while(!uiJoined)writer.wait(10);}
                writer.onMain(request,()->{if(dialog!=null){if(focusObserver!=null)dialog.getWindow().getDecorView().getViewTreeObserver().removeOnWindowFocusChangeListener(focusObserver);dialog.setOnDismissListener(null);dialog=null;}focusObserver=null;},true);}live();writer.host(request);
        }
        private byte[] message() throws Exception {StringBuilder value=new StringBuilder("LP-LOCAL-V2-FIRST-PROFILE\0v2\0");
            for(String field:new String[]{id,"create-initial-local-profile",digest(before),digest(next),digest(profile),data.identity,data.nonce,data.checksum,
                request.policy.version,request.policy.checksum,String.valueOf(request.policy.maximumIterations),Arrays.toString(request.policy.delays),
                String.valueOf(request.began),String.valueOf(request.deadline),String.valueOf(System.identityHashCode(request.activity)),String.valueOf(System.identityHashCode(request.token)),
                PinNativeOwnerAuthority.alias(request.activity),digest(keyEncoding),LocalV2PinOperation.hex(nonce)})value.append(field.length()).append(':').append(field);
            return value.toString().getBytes(StandardCharsets.UTF_8);}
        private void owner() throws Exception {
            live();require(android.os.Build.VERSION.SDK_INT>=30);KeyguardManager guard=(KeyguardManager)request.activity.getSystemService(Context.KEYGUARD_SERVICE);require(guard!=null&&guard.isDeviceSecure());
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias=PinNativeOwnerAuthority.alias(request.activity);require(keys.containsAlias(alias));
            PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,alias);signing=material.signature;publicKey=material.publicKey;keyEncoding=material.encoding;crypto=material.crypto;payload=message();signal=new android.os.CancellationSignal();phase=LocalV2ProfilePhase.owner;
            writer.onMain(request,()->{try{live();promptOutstanding=true;new android.hardware.biometrics.BiometricPrompt.Builder(request.activity)
                    .setTitle("ru".equals(locale)?"Подтвердите создание профиля":"Confirm profile creation").setSubtitle("ru".equals(locale)?"Используйте код блокировки устройства":"Use your device screen lock")
                    .setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build().authenticate(crypto,signal,task->{synchronized(writer){request.events++;}
                        if(!writer.main.post(()->{try{task.run();}finally{synchronized(writer){request.events--;writer.notifyAll();}}})){synchronized(writer){request.events--;writer.unknown(request);}}},
                    new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback(){public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){terminal(result);}
                        public void onAuthenticationError(int error,CharSequence description){terminal(null);}});
            }catch(Exception failure){promptOutstanding=false;revoke();}},false);
            for(;;){synchronized(writer){if(!promptOutstanding&&request.events==0)break;writer.wait(25);}try{live();}catch(Exception failure){revoke();}}
            joinCancel();live();require(ownerReturned);writer.host(request);signing.update(payload);signature=signing.sign();phase=LocalV2ProfilePhase.signed;verifyOwner();
        }
        private void terminal(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){synchronized(writer){if(writer.active!=request||request.detached)return;
            if(!promptOutstanding){writer.unknown(request);return;}ownerReturned=result!=null&&result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL
                &&result.getCryptoObject()==crypto&&crypto.getSignature()==signing;promptOutstanding=false;if(!ownerReturned)cancelled=true;writer.notifyAll();}}
        private void verifyOwner() throws Exception {
            require(ownerReturned&&signature!=null&&signature.length>=8&&signature.length<=80&&publicKey!=null&&keyEncoding!=null);
            KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias=PinNativeOwnerAuthority.alias(request.activity);require(keys.containsAlias(alias)&&keys.getKey(alias,null) instanceof java.security.PrivateKey);
            java.security.cert.Certificate certificate=keys.getCertificate(alias);require(certificate!=null);byte[] current=certificate.getPublicKey().getEncoded();
            byte[] expected=message();try{require(MessageDigest.isEqual(current,keyEncoding)&&MessageDigest.isEqual(expected,payload));java.security.Signature check=java.security.Signature.getInstance("SHA256withECDSA");
                check.initVerify(publicKey);check.update(payload);require(check.verify(signature));}finally{LocalSnapshotV2.wipe(expected);LocalSnapshotV2.wipe(current);}
        }
        private void boundary() throws Exception {require(publicationThread==Thread.currentThread());if(phase==LocalV2ProfilePhase.closed){request.processClock.closedReadback(request.processLease,digest(next));require(!cancelled&&!request.sealed);}
            else live();verifyOwner();require(beforeChecksum.equals(digest(before))&&request.profileOperation==this);}
        private void profileWriteBoundary(byte[] expected,byte[] proposed) throws Exception {
            require(phase==LocalV2ProfilePhase.profilePublishing&&dataSpent&&birth!=null&&worker==Thread.currentThread()&&uiJoined&&ownerReturned
                &&beforeChecksum.equals(digest(expected))&&MessageDigest.isEqual(before,expected)&&MessageDigest.isEqual(next,proposed));boundary();birth.readback(permit);
        }
        private void run(LocalV2ProfileRecipient recipient){try{LocalV2StorageReceipt anchor=writer.reanchor(request);if(anchor!=null)writer.acknowledge(anchor);
                synchronized(writer){live();before=request.currentBytes.clone();beforeChecksum=digest(before);}try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,request.policy)){next=LocalV2InitialProfile.create(old,profile);}
                data=PlanetChildDataStore.localV2BirthPlan(writer.vault.context,id.substring(32));confirm();owner();writer.host(request);publicationThread=Thread.currentThread();writer.begin(request);
                try{LocalV2StorageReceipt receipt=writer.vault.locked(directory->{boundary();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);
                    try{require(MessageDigest.isEqual(actual,before));LocalV2ClockSample sample=request.processClock.sample(request.processLease,actual);
                        // Fixed lock order: Vault native/file lock -> DataStore
                        // native/file lock. Permit fences perform no Vault IO,
                        // no recursive flock and no main-thread wait here.
                        birth=PlanetChildDataStore.localV2Birth(data,permit);birth.readback(permit);phase=LocalV2ProfilePhase.profilePublishing;
                        try(LocalSnapshotV2 old=LocalSnapshotV2.decode(actual,request.policy);LocalSnapshotV2 after=LocalSnapshotV2.decode(next,request.policy)){LocalV2InitialProfile.validate(old,after);}
                        verifyOwner();return writer.publish(request,actual,next,directory,sample,LocalV2ClockAction.profile);
                    }finally{LocalSnapshotV2.wipe(actual);}});writer.acknowledge(receipt);phase=LocalV2ProfilePhase.profileKnown;birth.readback(permit);
                }finally{writer.finish(request);}writer.host(request);live();recipient.published(this);live();delivered=true;
            }catch(Throwable failure){if(dataSpent||request.mutationStarted)writer.unknown(request);else try{writer.cancel(request);}catch(Exception ignored){}phase=LocalV2ProfilePhase.failed;revoke();}
            finally{if(promptOutstanding)revoke();synchronized(writer){while(promptOutstanding||request.events>0)try{writer.wait(10);}catch(InterruptedException interrupted){revoke();}}
                try{joinCancel();}catch(Exception failure){writer.unknown(request);}synchronized(writer){finished=true;request.pinWorkers--;writer.notifyAll();}}
        }
        private void closingObservers(boolean install) throws Exception {
            java.util.concurrent.FutureTask<Void> task=new java.util.concurrent.FutureTask<>(()->{
                android.app.Application app=(android.app.Application)writer.vault.context;
                if(install){closingLifecycle=new android.app.Application.ActivityLifecycleCallbacks(){public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}
                    public void onActivityStarted(android.app.Activity a){}public void onActivityResumed(android.app.Activity a){}public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}
                    public void onActivityPaused(android.app.Activity a){if(a==request.activity)cancelled=true;}public void onActivityStopped(android.app.Activity a){if(a==request.activity)cancelled=true;}
                    public void onActivityDestroyed(android.app.Activity a){if(a==request.activity)cancelled=true;}};app.registerActivityLifecycleCallbacks(closingLifecycle);
                    closingScreen=new android.content.BroadcastReceiver(){public void onReceive(Context c,android.content.Intent i){cancelled=true;}};
                    android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
                    if(android.os.Build.VERSION.SDK_INT>=33)writer.vault.context.registerReceiver(closingScreen,filter,Context.RECEIVER_NOT_EXPORTED);else writer.vault.context.registerReceiver(closingScreen,filter);
                    closingExpiry=()->cancelled=true;require(writer.main.postDelayed(closingExpiry,Math.max(1,request.deadline-SystemClock.elapsedRealtime())));
                }else{try{if(closingLifecycle!=null)app.unregisterActivityLifecycleCallbacks(closingLifecycle);}finally{try{if(closingScreen!=null)writer.vault.context.unregisterReceiver(closingScreen);}
                    finally{if(closingExpiry!=null)writer.main.removeCallbacks(closingExpiry);closingLifecycle=null;closingScreen=null;closingExpiry=null;}}}return null;
            });require(writer.main.post(task));boolean interrupted=false;for(;;)try{task.get();break;}catch(InterruptedException ignored){interrupted=true;}
            if(interrupted){Thread.currentThread().interrupt();throw new PinKnownRefusal();}
        }
        private void settle(){try{worker.join();joinCancel();live();require(delivered&&phase==LocalV2ProfilePhase.profileKnown&&request.receipt==null&&!request.unacknowledgedMutation);
                writer.host(request);publicationThread=Thread.currentThread();birth.readback(permit);closingObservers(true);writer.retire(request);phase=LocalV2ProfilePhase.closed;
                java.util.concurrent.FutureTask<Boolean> current=new java.util.concurrent.FutureTask<>(()->!cancelled&&!request.activity.isFinishing()&&!request.activity.isDestroyed()&&request.activity.hasWindowFocus()
                    &&request.activity.getWindow().getDecorView().getWindowToken()==request.token);require(writer.main.post(current));require(current.get());
                writer.vault.locked(directory->{boundary();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(actual,next));birth.readback(permit);boundary();return null;}finally{LocalSnapshotV2.wipe(actual);}});
                completion=new LocalV2ProfileCompletion(this);
            }catch(Throwable failure){revoke();if(!request.retired)try{writer.cancel(request);writer.retire(request);}catch(Throwable ignored){writer.unknown(request);}}
            finally{try{closingObservers(false);}catch(Throwable failure){completion=null;cancelled=true;}if(data!=null)data.close();LocalSnapshotV2.wipe(before);LocalSnapshotV2.wipe(next);LocalSnapshotV2.wipe(payload);LocalSnapshotV2.wipe(signature);LocalSnapshotV2.wipe(keyEncoding);LocalSnapshotV2.wipe(profile);LocalSnapshotV2.wipe(nonce);}}
        private LocalV2ProfileCompletion completion() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()&&Thread.currentThread()!=worker&&Thread.currentThread()!=settler);settler.join();
            synchronized(writer){boolean available=!completionConsumed;completionConsumed=true;require(available&&completion!=null&&!cancelled&&!request.sealed);
                request.processClock.closedReadback(request.processLease,completion.snapshotChecksum);return completion;}}
    }
    private static LocalV2Writer actualSdkLocalV2Writer(PlanetChildVault vault){return null;}
}
