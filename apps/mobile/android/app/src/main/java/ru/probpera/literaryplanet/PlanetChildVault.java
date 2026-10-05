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
    /** LOCAL-only actual route mode. Stronger v1 request types stay unchanged. */
    private static final class LocalV2GateContext {
        final String profileId,policyVersion,mode,visibility;final long profileRevision,routeRevision;
        private LocalV2GateContext(String profile,String policy,long revision,long route,String mode,String visibility) throws Exception {
            require(ProtectedEnvelope.identifier(profile)&&ProtectedEnvelope.identifier(policy)&&revision>=1&&revision<=MAX_SAFE&&route>=0&&route<=MAX_SAFE
                &&("child".equals(mode)||"adult".equals(mode))&&"active".equals(visibility));
            profileId=profile;policyVersion=policy;profileRevision=revision;routeRevision=route;this.mode=mode;this.visibility=visibility;
        }
    }
    private static final class LocalV2GateRequest {
        final Object originalHostChallenge;final String id,action,targetChecksum;final LocalV2GateContext context;final long generation,deadlineUptimeMs;
        private LocalV2GateRequest(Object original,String id,String action,String target,LocalV2GateContext context,long generation,long deadline) throws Exception {
            require(original!=null&&ProtectedEnvelope.hash(id)&&ProtectedEnvelope.hash(target)&&context!=null&&generation>=0&&generation<=MAX_SAFE&&deadline>0&&deadline<=MAX_SAFE
                &&Arrays.asList("exit-child-mode","switch-adult-profile","change-exact-age","change-blocked-topics","open-adult-store","initiate-purchase","restore-purchases",
                    "open-external","share","account-change","export-child-data","delete-child-data","diagnostics","expand-access-settings","enable-licensed-pack","view-legal-commercial").contains(action)
                &&(!"adult".equals(context.mode)||"expand-access-settings".equals(action)));
            originalHostChallenge=original;this.id=id;this.action=action;targetChecksum=target;this.context=context;this.generation=generation;deadlineUptimeMs=deadline;
        }
    }
    /** UID birth belongs to the native invocation before its original target
     * checksum/PIN request. Caller IDs and unknown fields cannot be adopted.
     * Prepared bytes alone remain structural data, never authority. */
    private static final class LocalV2NativeProfileTarget {
        final byte[] bytes;final String generatedId;
        private LocalV2NativeProfileTarget(byte[] bytes,String id){this.bytes=bytes;generatedId=id;}
        private static LocalV2NativeProfileTarget own(String action,byte[] raw) throws Exception {
            require(raw!=null&&raw.length<=MAX_BYTES);if(!"expand-access-settings".equals(action)||raw.length==0)return new LocalV2NativeProfileTarget(raw.clone(),null);
            java.util.Map<String,Object> target=LocalV2PackageJson.object(LocalV2PackageJson.read(raw,65536));
            if(!target.containsKey("createProfile"))return new LocalV2NativeProfileTarget(raw.clone(),null);
            LocalV2PackageJson.object(target,"createProfile");java.util.Map<String,Object> proposal=LocalV2PackageJson.object(target.get("createProfile"));require(!proposal.containsKey("id"));
            byte[] random=new byte[16],profile=null,effective=null;boolean handed=false;
            try{new java.security.SecureRandom().nextBytes(random);String id="profile-"+LocalV2PinOperation.hex(random);
                java.util.LinkedHashMap<String,Object> owned=new java.util.LinkedHashMap<>();owned.put("id",id);owned.putAll(proposal);profile=LocalV2PackageJson.bytes(owned,false);require(LocalV2InitialProfile.profileId(profile).equals(id));
                java.util.LinkedHashMap<String,Object> wrapper=new java.util.LinkedHashMap<>();wrapper.put("createProfile",owned);effective=LocalV2PackageJson.bytes(wrapper,false);require(effective.length<=65536);
                handed=true;return new LocalV2NativeProfileTarget(effective,id);
            }finally{LocalSnapshotV2.wipe(random);LocalSnapshotV2.wipe(profile);if(!handed)LocalSnapshotV2.wipe(effective);}
        }
    }
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
    private enum LocalV2ClockAction { reanchor, enroll, charge, finalize, profile, canonical, rotate }
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
                        if(action==LocalV2ClockAction.rotate){require(lease.original instanceof LocalV2Request);LocalV2Request original=(LocalV2Request)lease.original;require(original.sdkRotation!=null&&original.sdkRotation.request==original);original.sdkRotation.verifyOwner(true);require(MessageDigest.isEqual(before,original.sdkRotation.original)&&MessageDigest.isEqual(after,original.sdkRotation.nextBytes));LocalV2PinVerifier verifier=LocalV2PinOperation.verifier(value);expected=sdkRotate(old,verifier.saltHex,value.credentialId,verifier.hashHex);}
                        else if(action==LocalV2ClockAction.canonical){require(lease.original instanceof LocalV2GateMutation);LocalV2GateMutation mutation=(LocalV2GateMutation)lease.original;mutation.boundary();LocalV2CanonicalTransition.validate(old,value,mutation.original.action,mutation.target);expected=after.clone();}
                        else if(action==LocalV2ClockAction.profile){LocalV2InitialProfile.validate(old,value);expected=after.clone();}
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
        private LocalV2ProfileOperation profileOperation; private LocalV2SDKPinRotation sdkRotation; private LocalV2NativePackageLoader sdkPackageLoader;
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
    /** Actual existing-AES/AtomicFile/flock owner, with SDK entry kept private:
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
        private LocalV2Request gateRequest(android.app.Activity activity,LocalSnapshotV2Policy policy,LocalV2GateRequest original) throws Exception {
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
                if(request.unacknowledgedMutation||request.receipt!=null)request.processClock.invalidate(request.processLease);if(request.pinOperation!=null)request.pinOperation.revoke();if(request.profileOperation!=null)request.profileOperation.revoke();if(request.sdkRotation!=null)request.sdkRotation.revoke();}
            synchronized(this){request.events--;wipeIdle(request);notifyAll();}}
        private void wipeIdle(LocalV2Request request){if((request.cancelled||request.sealed)&&request.workers==0&&request.pinWorkers==0&&request.pinCancelCalls==0&&request.settleCalls==0&&request.mainCalls==0&&request.events==0){
            LocalSnapshotV2.wipe(request.currentBytes);if(request.receipt!=null)request.receipt.wipe();if(request.reservation!=null)request.reservation.wipe();
            if(request.enrollmentSample!=null)request.enrollmentSample.wipe();}}
        private void paused(LocalV2Request request){synchronized(this){if(active!=request||request.detached)return;
            if(request.pinOperation!=null&&request.pinOperation.ownedOwnerPause()||request.profileOperation!=null&&request.profileOperation.ownedOwnerPause()||request.sdkRotation!=null&&request.sdkRotation.ownedPrompt())return;}event(request);}
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
            if(lost[0]||!(operation!=null&&(operation.ownerReturned||operation.uiJoined)||profile!=null&&(profile.ownerReturned||profile.uiJoined)||request.sdkRotation!=null&&(request.sdkRotation.ownerReturned||request.sdkRotation.uiJoined))){event(request);throw new PinKnownRefusal();}
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
            synchronized(this){request.mutationStarted=true;request.unacknowledgedMutation=true;}vault.writeExact(directory,next,()->{live(request);if(action==LocalV2ClockAction.rotate)request.sdkRotation.verifyOwner(true);if(action==LocalV2ClockAction.profile)request.profileOperation.profileWriteBoundary(expected,next);});
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
        private LocalV2PinOperation verificationOperation(LocalV2Request request,LocalV2GateRequest original,String locale) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());synchronized(this){live(request);require(request.pinOperation==null&&original!=null&&original.deadlineUptimeMs==request.deadline);}
            // Gate capture already acknowledged the one original re-anchor. Never rewrite it here.
            byte[] bytes;
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
        private void chargeProducer(LocalV2Request request) throws Exception { if(request.sdkRotation!=null){request.sdkRotation.chargeBoundary();return;}
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
            if(request.pinOperation!=null)request.pinOperation.revoke();if(request.profileOperation!=null)request.profileOperation.revoke();if(request.sdkRotation!=null)request.sdkRotation.revoke();wipeIdle(request);notifyAll();}
        private void retire(LocalV2Request request) throws Exception {retireJoined(request,null);}
        private void retireProfile(LocalV2ProfileOperation original) throws Exception {require(original!=null&&original.writer==this&&original.settler==Thread.currentThread()&&original.finished&&!original.worker.isAlive()
            &&original.delivered&&original.uiJoined&&original.phase==LocalV2ProfilePhase.profileKnown&&original.request.receipt==null&&!original.request.unacknowledgedMutation);retireJoined(original.request,original);}
        private void releaseProfileRetirement(LocalV2ProfileOperation original) throws Exception {synchronized(this){LocalV2Request request=original.request;require(original.writer==this&&original.settler==Thread.currentThread());if(active==request&&request.retired&&!request.processLease.closed){
            if(original.completion==null){request.processClock.invalidate(request.processLease);return;}request.processClock.release(request.processLease);active=null;}}}
        private void retireJoined(LocalV2Request request,LocalV2ProfileOperation retainedProfile) throws Exception {retireJoined(request,retainedProfile,null);}
        private void retireJoined(LocalV2Request request,LocalV2ProfileOperation retainedProfile,CommitCheck terminal) throws Exception {
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
                        finally{if(request.expiry!=null)main.removeCallbacks(request.expiry);}}cleaned[0]=true;},true);                if(terminal!=null){synchronized(this){require(cleaned[0]&&!sealed&&!request.sealed&&request.receipt==null&&!request.unacknowledgedMutation&&request.workers==0&&request.pinWorkers==0&&request.mainCalls==0&&request.events==0);request.detached=true;}terminal.check();}
                synchronized(this){own(request);require(request.retiring&&request.workers==0&&request.pinWorkers==0&&request.pinCancelCalls==0&&request.settleCalls==0&&request.mainCalls==0&&request.events==0);
                    if(request.receipt!=null||request.unacknowledgedMutation){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;}
                    if(!cleaned[0]||sealed||request.sealed){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;}
                    request.detached=cleaned[0];LocalSnapshotV2.wipe(request.currentBytes);if(request.receipt!=null){request.receipt.wipe();request.receipt=null;}if(request.reservation!=null)request.reservation.wipe();
                    if(request.enrollmentSample!=null)request.enrollmentSample.wipe();
                    // Only after every real callback and cleanup returned can
                    // the static slot drop the original Activity/request graph.
                    if(retainedProfile==null){if(sealed||request.sealed||request.profileOperation!=null&&request.profileOperation.dataSpent){request.processClock.invalidate(request.processLease);request.sealed=true;sealed=true;}else{request.processClock.release(request.processLease);active=null;}}
                    else require(request.profileOperation==retainedProfile&&retainedProfile.settler==Thread.currentThread()&&retainedProfile.finished&&!retainedProfile.worker.isAlive()&&retainedProfile.delivered
                        &&retainedProfile.phase==LocalV2ProfilePhase.profileKnown&&request.receipt==null&&!request.unacknowledgedMutation);
                    request.retired=true;if(operation!=null)operation.wipeOriginal();if(sealed||request.sealed)throw new Unavailable();}
            }catch(Throwable failure){unknown(request);synchronized(this){if(request.workers==0&&request.settleCalls==0){if(request.receipt!=null)request.receipt.wipe();if(request.reservation!=null)request.reservation.wipe();}}throw failed(request,failure);}
        }

        /** Classify only fully validated existing records; malformed bytes are never a seed. */
        private static boolean sdkIsSeed(byte[] raw,LocalSnapshotV2Policy policy) throws Exception {
            try(LocalEmptySeedV2 checked=LocalEmptySeedV2.decode(raw,policy.version,policy.checksum)){return true;}
            catch(Exception notSeed){try(LocalSnapshotV2 checked=LocalSnapshotV2.decode(raw,policy)){return false;}}
        }
        private byte[] sdkOpen(LocalV2Request request) throws Exception {
            host(request);byte[] raw=vault.locked(directory->{live(request);SDKInstallTerminal.known(vault,directory,request.policy);completeRecord(directory);return vault.readExact(directory);});
            boolean seed;try{seed=sdkIsSeed(raw,request.policy);}finally{LocalSnapshotV2.wipe(raw);}
            if(seed){begin(request);try{host(request);vault.locked(directory->{live(request);completeRecord(directory);byte[] current=vault.readExact(directory);try(LocalEmptySeedV2 checked=LocalEmptySeedV2.decode(current,request.policy.version,request.policy.checksum)){request.processClock.sampleSeed(request.processLease,current);synchronized(this){live(request);require(!request.anchored&&request.currentBytes==null);request.currentBytes=current.clone();request.currentChecksum=checked.checksum;request.anchored=true;}return null;}finally{LocalSnapshotV2.wipe(current);}});}finally{finish(request);}}
            else{LocalV2StorageReceipt receipt=reanchor(request);if(receipt!=null)acknowledge(receipt);}
            return sdkRead(request);
        }
        private byte[] sdkRead(LocalV2Request request) throws Exception {
            begin(request);byte[] out=null;try{host(request);out=vault.locked(directory->{live(request);SDKInstallTerminal.known(vault,directory,request.policy);completeRecord(directory);byte[] current=vault.readExact(directory);boolean handed=false;try{require(request.anchored&&request.currentBytes!=null&&MessageDigest.isEqual(request.currentBytes,current));request.processClock.sample(request.processLease,current);handed=true;return current;}finally{if(!handed)LocalSnapshotV2.wipe(current);}});host(request);byte[] value=out;out=null;return value;}catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(out);finish(request);}
        }
        private void sdkInspectData(LocalV2Request request,byte[] original) throws Exception {
            begin(request);try{host(request);vault.locked(directory->{live(request);require(MessageDigest.isEqual(original,request.currentBytes));LocalV2SDKReadPermit permit=new LocalV2SDKReadPermit(this,request,directory,original);try{PlanetChildDataStore.sdkInspectOriginal(permit);permit.check();return null;}finally{permit.close();}});host(request);}catch(Throwable failure){throw failed(request,failure);}finally{finish(request);}
        }
        private LocalV2SDKPackageHandoff sdkPackageHandoff(LocalV2Request request,byte[] captured) throws Exception {
            begin(request);try{host(request);return vault.locked(directory->{
                live(request);completeRecord(directory);require(request.anchored&&request.receipt==null&&!request.unacknowledgedMutation&&request.sdkPackageLoader==null);
                byte[] current=vault.readExact(directory);try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(current,request.policy)){
                    request.processClock.sample(request.processLease,current);require(MessageDigest.isEqual(captured,current)&&MessageDigest.isEqual(current,request.currentBytes));
                    LocalV2PackageProfile profile=new LocalV2PackageProfile(saved);
                    return new LocalV2SDKPackageHandoff(this,request,current,profile.recordChecksum);
                }finally{LocalSnapshotV2.wipe(current);}
            });}catch(Throwable failure){throw failed(request,failure);}finally{finish(request);}
        }
        private boolean sdkCatalogMissingPins(LocalV2Request request) throws Exception {
            byte[] before=sdkRead(request),catalog=null,artifact=null,after=null;try{
                catalog=sdkAsset(request,"child-native/catalog-v1.json",65536);artifact=sdkAsset(request,"artifact.json",2097152);LocalV2PackageCatalog c=new LocalV2PackageCatalog(catalog,artifact,"android");after=sdkRead(request);require(MessageDigest.isEqual(before,after));return c.keys.isEmpty()&&c.pins.isEmpty();
            }finally{LocalSnapshotV2.wipe(before);LocalSnapshotV2.wipe(catalog);LocalSnapshotV2.wipe(artifact);LocalSnapshotV2.wipe(after);}
        }
        private byte[] sdkAsset(LocalV2Request request,String fixed,int bound) throws Exception {
            live(request);require("artifact.json".equals(fixed)||"child-native/catalog-v1.json".equals(fixed));byte[] buffer=new byte[bound];int at=0;
            try(java.io.InputStream in=vault.context.getAssets().open("public/"+fixed,android.content.res.AssetManager.ACCESS_STREAMING)){for(;;){live(request);if(at==bound){require(in.read()==-1);break;}int n=in.read(buffer,at,Math.min(8192,bound-at));if(n<0)break;require(n>0);at+=n;}live(request);require(at>0);return Arrays.copyOf(buffer,at);}finally{LocalSnapshotV2.wipe(buffer);}
        }


        private LocalV2StorageReceipt sdkFinalizeRotation(LocalV2SDKPinRotation original) throws Exception {
            LocalV2Request request=original.request;synchronized(this){live(request);require(request.sdkRotation==original&&!original.recover&&original.worker==Thread.currentThread()&&original.phase==LocalV2PinPhase.finalizing&&original.compared&&original.outcome!=null&&original.uiJoined&&request.reservation!=null&&request.receipt==null&&!request.unacknowledgedMutation);}
            original.exactCharged();begin(request);byte[] expected=request.reservation.charged.clone();
            try{host(request);LocalV2StorageReceipt receipt=vault.locked(directory->{live(request);completeRecord(directory);byte[] actual=vault.readExact(directory),next=null;
                try{require(MessageDigest.isEqual(actual,expected));LocalV2ClockSample sample=request.processClock.sample(request.processLease,actual);try(LocalSnapshotV2 old=LocalSnapshotV2.decode(actual,request.policy)){next=LocalSnapshotV2.attempt(old,original.outcome==PinVerificationOutcome.match?0:old.count,null,sample.logicalMs);return publish(request,actual,next,directory,sample,LocalV2ClockAction.finalize);}}
                finally{LocalSnapshotV2.wipe(actual);LocalSnapshotV2.wipe(next);}});host(request);return receipt;
            }catch(Throwable failure){throw failed(request,failure);}finally{LocalSnapshotV2.wipe(expected);finish(request);}
        }
        private LocalV2StorageReceipt sdkCommitRotation(LocalV2SDKPinRotation original) throws Exception {
            LocalV2Request request=original.request;synchronized(this){live(request);require(request.sdkRotation==original&&original.worker==Thread.currentThread()&&original.phase==LocalV2PinPhase.finalizing&&original.uiJoined&&original.dialog==null&&original.ownerReturned&&!original.promptOutstanding&&request.receipt==null&&!request.unacknowledgedMutation);}begin(request);
            try{host(request);LocalV2StorageReceipt receipt=vault.locked(directory->{live(request);original.verifyOwner(true);completeRecord(directory);byte[] actual=vault.readExact(directory);
                try{require(MessageDigest.isEqual(actual,original.original));original.pending(directory);LocalV2ClockSample sample=request.processClock.sample(request.processLease,actual);return publish(request,actual,original.nextBytes,directory,sample,LocalV2ClockAction.rotate);}
                finally{LocalSnapshotV2.wipe(actual);}});host(request);return receipt;
            }catch(Throwable failure){throw failed(request,failure);}finally{finish(request);}
        }
        private void sdkRetireRotation(LocalV2SDKPinRotation original) throws Exception {
            require(original.request.sdkRotation==original&&original.settler==Thread.currentThread()&&original.finished&&original.known&&original.worker!=null&&!original.worker.isAlive()&&original.cancelWorker==null&&original.dialog==null&&original.uiJoined);
            retireJoined(original.request,null,original::complete);
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
        final LocalV2PinOperation operation;final LocalV2GateRequest gate;final String checksum;final LocalV2PinKind kind;
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
        private PinVerificationOutcome consume(LocalV2GateRequest original) throws Exception {
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
        final LocalV2Writer writer;final LocalV2Request request;final LocalV2PinKind kind;final LocalV2GateRequest gate;
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
        private LocalV2PinOperation(LocalV2Writer writer,LocalV2Request request,LocalV2PinKind kind,LocalV2GateRequest gate,
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
        private static void context(LocalSnapshotV2 record,LocalV2GateRequest gate) throws Exception {
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
        private void showNativeProfileTarget(android.content.Context ui,android.widget.LinearLayout content) throws Exception {
            if(gate==null||!"expand-access-settings".equals(gate.action)||!(gate.originalHostChallenge instanceof LocalV2GateInvocation))return;
            LocalV2GateInvocation invocation=(LocalV2GateInvocation)gate.originalHostChallenge;require(invocation.original==gate&&invocation.scope!=null&&digest(invocation.target).equals(gate.targetChecksum));
            java.util.Map<String,Object> value=LocalV2PackageJson.object(LocalV2PackageJson.read(invocation.target,65536));org.json.JSONObject profile=null;boolean creation=value.containsKey("createProfile"),ru="ru".equals(locale);
            if(creation){LocalV2PackageJson.object(value,"createProfile");require(invocation.generatedProfileId!=null);profile=new org.json.JSONObject(LocalV2PackageJson.json(value.get("createProfile"),false));require(profile.getString("id").equals(invocation.generatedProfileId));}
            else if(value.containsKey("profileId")){LocalV2PackageJson.object(value,"profileId");String id=LocalV2PackageJson.identifier(value.get("profileId"));org.json.JSONArray profiles=new org.json.JSONObject(new String(original,StandardCharsets.UTF_8)).getJSONObject("protectedRecord").getJSONObject("registry").getJSONArray("profiles");
                for(int i=0;i<profiles.length();i++){org.json.JSONObject candidate=profiles.getJSONObject(i);if(id.equals(candidate.getString("id"))){require(profile==null);profile=candidate;}}require(profile!=null);}
            else return;
            android.widget.TextView purpose=text(ui,16);purpose.setText(creation?(ru?"Подтвердите дополнительный локальный профиль и детский режим":"Confirm the additional local profile and child mode"):(ru?"Подтвердите выбранный детский профиль":"Confirm the selected child profile"));content.addView(purpose);
            String[][] fields={{"label","Имя","Label"},{"exactAge","Точный возраст","Exact age"},{"ageBand","Возрастная группа","Age band"},{"locale","Язык","Language"},{"ageConfirmedAt","Подтверждение возраста","Age confirmation"},
                {"readingLevel","Уровень чтения","Reading level"},{"allowedTopics","Разрешённые темы","Allowed topics"},{"blockedTopics","Закрытые темы","Blocked topics"},{"soundEnabled","Звук","Sound"},{"motion","Движение","Motion"},{"narrationEnabled","Озвучивание","Narration"},{"localeLocked","Фиксация языка","Language lock"}};
            for(String[] field:fields){android.widget.TextView row=text(ui,14);row.setText(field[ru?1:2]+": "+LocalV2ProfileOperation.confirmationValue(profile,field[0],ru));content.addView(row);}
        }
        private void presentInput(){try{live();android.content.Context ui=localeContext();dialog=new android.app.Dialog(request.activity);dialog.setCancelable(true);dialog.setCanceledOnTouchOutside(false);
                android.widget.LinearLayout content=new android.widget.LinearLayout(ui);content.setOrientation(android.widget.LinearLayout.VERTICAL);content.setPadding(dp(16),dp(16),dp(16),dp(16));content.setSaveEnabled(false);
                dialog.setOwnerActivity(request.activity);content.setFilterTouchesWhenObscured(true);if(android.os.Build.VERSION.SDK_INT>=26)content.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                android.graphics.drawable.GradientDrawable panel=new android.graphics.drawable.GradientDrawable();panel.setColor(0xff101827);panel.setCornerRadius(dp(22));content.setBackground(panel);
                android.widget.TextView title=text(ui,22);title.setText(label(R.string.native_pin_title));content.addView(title);
                if(gate!=null){android.widget.TextView actionLabel=text(ui,14);actionLabel.setText(label(PinVerificationNativeInput.actionResource(gate.action)));content.addView(actionLabel);showNativeProfileTarget(ui,content);}
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
        final LocalV2GateContext context;final String locale,registryChecksum,protectedChecksum,credential;
        final long rootRevision,pinRevision;
        private LocalV2GateScope(LocalSnapshotV2 snapshot) throws Exception {
            byte[] raw=snapshot.copy();try{
                ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,snapshot.protectedStart,snapshot.protectedEnd-snapshot.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);rootRevision=p.number(1,MAX_SAFE);
                p.field("mode",false);String mode=p.string();require("child".equals(mode)||"adult".equals(mode));p.field("selectionRevision",false);long selection=p.number(1,MAX_SAFE);
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
                locale=selectedLocale;context=new LocalV2GateContext(active,snapshot.policy.version,revision,selection,mode,"active");
                protectedChecksum=snapshot.protectedChecksum;credential=snapshot.credentialId;pinRevision=snapshot.pinRevision;
            }finally{LocalSnapshotV2.wipe(raw);}
        }
        private void initial(LocalSnapshotV2 current) throws Exception {
            require(current.revision==rootRevision&&current.pinRevision==pinRevision&&current.protectedChecksum.equals(protectedChecksum));same(current);
        }
        private void same(LocalSnapshotV2 current) throws Exception {
            LocalV2GateScope actual=new LocalV2GateScope(current);require(context.profileId.equals(actual.context.profileId)
                &&context.policyVersion.equals(actual.context.policyVersion)&&context.profileRevision==actual.context.profileRevision
                &&context.routeRevision==actual.context.routeRevision&&context.mode.equals(actual.context.mode)&&registryChecksum.equals(actual.registryChecksum)
                &&locale.equals(actual.locale)&&credential.equals(actual.credential));
        }
    }
    /** One native button invocation. The request token is this exact object;
     * target bytes are owned before native capture. No public capability is
     * exposed and no bare boolean can enter the transfer boundary. */
    private static final class LocalV2GateInvocation {
        final String id,action,targetChecksum,generatedProfileId;final long generation,began,deadline;private final byte[] target;
        private LocalV2GateRequest original;private LocalV2GateScope scope;private boolean spent,revoked;private long last;
        private LocalV2GateInvocation(String action,byte[] target,long generation,long began,long verificationMs,long capabilityMs) throws Exception {
            require(target!=null&&target.length<=MAX_BYTES&&generation>=0&&generation<=MAX_SAFE&&began>=0&&began<=MAX_SAFE
                &&verificationMs>0&&verificationMs<=60000&&capabilityMs>0&&capabilityMs<=2147483647L);
            long duration=Math.min(verificationMs,capabilityMs);require(began<=MAX_SAFE-duration);
            LocalV2NativeProfileTarget owned=LocalV2NativeProfileTarget.own(action,target);this.action=action;this.target=owned.bytes;generatedProfileId=owned.generatedId;targetChecksum=digest(this.target);this.generation=generation;this.began=began;last=began;deadline=began+duration;
            byte[] nonce=new byte[32];try{new java.security.SecureRandom().nextBytes(nonce);id=LocalV2PinOperation.hex(nonce);}finally{LocalSnapshotV2.wipe(nonce);}
        }
        private synchronized void live(long now) throws Exception {if(spent||revoked||now<last||now>=deadline){revoked=true;throw new PinKnownRefusal();}last=now;}
        private synchronized LocalV2GateRequest capture(LocalV2GateScope exact,long now) throws Exception {
            live(now);require(scope==null&&original==null&&exact!=null);scope=exact;original=new LocalV2GateRequest(this,id,action,targetChecksum,exact.context,generation,deadline);return original;
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
            transferred=reply;return target.clone();
        }
        private LocalV2PinReply transferred;
        private synchronized void execution(LocalV2PinReply reply,long now) throws Exception {if(!spent||reply==null||transferred==null||transferred!=reply||revoked||now<last||now>=deadline){revoked=true;throw new PinKnownRefusal();}last=now;}
        private synchronized void hostCurrent(long now) throws Exception {if(transferred==null)live(now);else execution(transferred,now);}
        private synchronized void revoke(){revoked=true;}
        private synchronized void close(){spent=true;transferred=null;LocalSnapshotV2.wipe(target);}
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
        private volatile boolean closed,revoked;private long generation;private Thread worker;private long sdkDeadline;private volatile Throwable sdkFailure;private volatile LocalV2GateMutation mutation;private Thread retirement;
        private android.app.Application.ActivityLifecycleCallbacks lifecycle;private android.content.BroadcastReceiver screen;
        private androidx.activity.OnBackPressedCallback back;private android.view.View.OnAttachStateChangeListener attachment;
        private android.view.ViewTreeObserver.OnWindowFocusChangeListener focus;private android.view.ViewTreeObserver.OnGlobalLayoutListener layout;private Runnable expiry;
        private LocalV2GateHost(PlanetChildVault vault,android.app.Activity host,android.view.ViewGroup route,android.widget.Button control,
            LocalSnapshotV2Policy policy,String action,byte[] target,long verificationMs,long capabilityMs,LocalV2NativeProtectedAction dispatch) throws Exception {
            this(vault,host,route,control,policy,action,target,verificationMs,capabilityMs,0,dispatch);
        }
private LocalV2GateHost(PlanetChildVault vault,android.app.Activity host,android.view.ViewGroup route,android.widget.Button control,
            LocalSnapshotV2Policy policy,String action,byte[] target,long verificationMs,long capabilityMs,long sdkDeadline,LocalV2NativeProtectedAction dispatch) throws Exception {
            this.sdkDeadline=sdkDeadline;
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
            new LocalV2GateRequest(new Object(),LocalV2PinOperation.hex(new byte[32]),action,digest(this.target),new LocalV2GateContext("native-validation",policy.version,1,0,"child","active"),0,1);
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
            require(activity.hasWindowFocus()||allowInput&&ownedInput());LocalV2GateInvocation original=invocation;if(original!=null)original.hostCurrent(SystemClock.elapsedRealtime());
        }
        private void attach() throws Exception {
            lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}
                public void onActivityStarted(android.app.Activity a){}public void onActivityResumed(android.app.Activity a){}
                public void onActivityPaused(android.app.Activity a){if(a==activity)revoke();}public void onActivityStopped(android.app.Activity a){if(a==activity)revoke();}
                public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}public void onActivityDestroyed(android.app.Activity a){if(a==activity)revoke();}};
            ((android.app.Application)writer.vault.context).registerActivityLifecycleCallbacks(lifecycle);
            screen=new android.content.BroadcastReceiver(){public void onReceive(Context c,android.content.Intent i){revoke();}};
            android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
            if(android.os.Build.VERSION.SDK_INT>=33)writer.vault.context.registerReceiver(screen,filter,android.content.Context.RECEIVER_NOT_EXPORTED);else writer.vault.context.registerReceiver(screen,filter);
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
                long began=SystemClock.elapsedRealtime();long duration=sdkDeadline==0?verificationMs:sdkDeadline-began;require(duration>0&&duration<=60000);LocalV2GateInvocation original=new LocalV2GateInvocation(action,target,generation,began,duration,sdkDeadline==0?capabilityMs:duration);invocation=original;
                expiry=this::revoke;require(main.postDelayed(expiry,Math.max(1,original.deadline-SystemClock.elapsedRealtime())));
                worker=new Thread(()->run(original),"planet-local-v2-native-gate");try{worker.start();}catch(Throwable failure){if(worker.getState()==Thread.State.NEW)worker=null;throw failure;}
            }catch(Throwable failure){revoke();if(worker==null){try{detach();}catch(Throwable ignored){}closed=true;LocalSnapshotV2.wipe(target);}}}
        private void run(LocalV2GateInvocation original){LocalV2PinReply[] delivered={null};boolean retired=false;
            try{onMain(()->{current(false);request=writer.requestAt(activity,policy,0,original.deadline);return null;});LocalV2StorageReceipt anchor=writer.reanchor(request);if(anchor!=null)writer.acknowledge(anchor);
                LocalV2GateScope scope=writer.vault.locked(directory->{original.live(SystemClock.elapsedRealtime());writer.completeRecord(directory);
                    byte[] bytes=writer.vault.readExact(directory);try{request.processClock.inspect(request.processLease,bytes);require(request.currentBytes!=null&&MessageDigest.isEqual(request.currentBytes,bytes));try(LocalSnapshotV2 snapshot=LocalSnapshotV2.decode(bytes,policy)){return new LocalV2GateScope(snapshot);}}finally{LocalSnapshotV2.wipe(bytes);}});
                LocalV2GateRequest gate=original.capture(scope,SystemClock.elapsedRealtime());onMain(()->{current(false);require(request.deadline==gate.deadlineUptimeMs);return null;});
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
                    try{if(LocalV2CanonicalTransition.handles(original.action))mutation=new LocalV2GateMutation(this,original,reply,payload);else dispatch.perform(original.action,payload);}
                    finally{LocalSnapshotV2.wipe(payload);}return null;});
                if(mutation!=null)mutation.perform();
            }catch(Throwable failure){sdkFailure=failure;revoke();}
            finally{if(request!=null&&!retired&&!request.retired){try{writer.cancel(request);if(operation!=null&&operation.worker!=null){operation.worker.join();operation.joinCancel();}
                        LocalV2PinReply reply=delivered[0];if(reply!=null&&!reply.settled)operation.settle(reply,PinReplyDelivery.uncertain);else writer.retire(request);
                    }catch(Throwable ignored){writer.unknown(request);}}
                if(mutation!=null){retirement=new Thread(()->{try{boolean interrupted=false;for(;;)try{worker.join();break;}catch(InterruptedException ignored){interrupted=true;}
                            if(operation!=null&&operation.closedLifecycle!=null)operation.closedObservers(false);
                            try{mutation.publishRetired();}catch(Throwable failure){revoke();if(mutation.lease!=null)request.processClock.invalidate(mutation.lease);}
                            onMain(()->{detach();closed=true;return null;});mutation.retirement();original.close();LocalSnapshotV2.wipe(target);if(interrupted)Thread.currentThread().interrupt();}
                        catch(Throwable failure){revoke();if(mutation.lease!=null)request.processClock.invalidate(mutation.lease);}},"planet-local-v2-gate-retirement");
                    try{retirement.start();}catch(Throwable failure){revoke();if(mutation.lease!=null)request.processClock.invalidate(mutation.lease);}}
                else{if(operation!=null&&operation.closedLifecycle!=null)try{operation.closedObservers(false);}catch(Throwable ignored){revoke();}
                    try{onMain(()->{detach();closed=true;original.close();LocalSnapshotV2.wipe(target);return null;});}catch(Throwable ignored){revoke();original.close();LocalSnapshotV2.wipe(target);}}}
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
        private void sdkAwait(long deadline) throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());while(worker==null&&!closed&&!revoked){require(SystemClock.elapsedRealtime()<deadline);Thread.sleep(10);}require(worker!=null);}
        private void sdkCleanupJoined() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());if(worker!=null)worker.join();if(retirement!=null)retirement.join();require(closed&&(request==null||request.retired&&!request.sealed&&!request.processClock.invalid)&&writer.active==null);if(mutation!=null)require(mutation.retired&&mutation.known);}
        private void sdkJoin() throws Exception {sdkCleanupJoined();if(sdkFailure!=null){if(sdkFailure instanceof Exception)throw(Exception)sdkFailure;throw new Unavailable();}}    }
    /** A prepared byte transition is data, never admission or permission. The
     * original Gate below is the only consumer allowed to write its adult exit.
     * Profile/access changes retain the previous safe record until an actual
     * independently reviewed compatible package can be admitted. */
    private static final class LocalV2CanonicalTransition {
        final String action;final byte[] bytes;final boolean requiresPackage;
        private LocalV2CanonicalTransition(String action,byte[] bytes,boolean requiresPackage){this.action=action;this.bytes=bytes;this.requiresPackage=requiresPackage;}
        private static boolean handles(String action){return "exit-child-mode".equals(action)||"switch-adult-profile".equals(action)
            ||"change-exact-age".equals(action)||"change-blocked-topics".equals(action)||"expand-access-settings".equals(action);}
        private void requireAdultExit() throws Exception {if(requiresPackage||!("exit-child-mode".equals(action)||"switch-adult-profile".equals(action)))throw new PinKnownRefusal();}
        private static java.util.LinkedHashMap<String,String> profileFields(String text) throws Exception {
            LocalV2InitialProfile.profileId(text.getBytes(StandardCharsets.UTF_8));java.util.LinkedHashMap<String,String> fields=new java.util.LinkedHashMap<>();
            ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(text);p.token("{");
            do{String key=p.string();p.token(":");int start=p.index,depth=0;boolean quoted=false,escaped=false;
                while(p.index<text.length()){char c=text.charAt(p.index);if(quoted){p.index++;if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c=='\"')quoted=false;continue;}
                    if(c=='\"')quoted=true;else if(c=='[')depth++;else if(c==']')depth--;else if(depth==0&&(c==','||c=='}'))break;p.index++;}
                require(p.index>start&&depth==0&&!quoted&&fields.put(key,text.substring(start,p.index))==null);
            }while(p.take(","));p.token("}");require(p.index==text.length());return fields;
        }
        private static LocalV2CanonicalTransition prepare(LocalSnapshotV2 before,String action,byte[] target) throws Exception {
            require(handles(action)&&target!=null&&target.length<=65536&&before.revision<MAX_SAFE&&before.journalRevision<MAX_SAFE);
            byte[] raw=before.copy(),registry=null,protectedBytes=null,result=null;boolean adopted=false;
            try{ProtectedEnvelope.Cursor p=new ProtectedEnvelope.Cursor(new String(raw,before.protectedStart,before.protectedEnd-before.protectedStart,StandardCharsets.UTF_8));
                p.field("schemaVersion",true);p.number(2,2);p.field("revision",false);require(p.number(1,MAX_SAFE)==before.revision);
                p.field("mode",false);String originalMode=p.string();require("child".equals(originalMode)||"adult".equals(originalMode)&&"expand-access-settings".equals(action));p.field("selectionRevision",false);long selection=p.number(1,MAX_SAFE);
                p.field("profileRevision",false);long revision=p.number(1,MAX_SAFE);require(selection<MAX_SAFE);
                p.field("policyChecksum",false);require(p.string().equals(before.policy.checksum));p.field("registryChecksum",false);String oldSum=p.string();
                p.field("registry",false);int start=p.index;String active=ProtectedEnvelope.registry(p,before.policy.version);require(active!=null);
                String oldRegistry=p.text.substring(start,p.index);ProtectedEnvelope.Cursor r=new ProtectedEnvelope.Cursor(oldRegistry);
                r.field("schemaVersion",true);r.number(1,1);r.field("policyVersion",false);r.string();r.field("activeProfileId",false);r.string();r.field("profiles",false);r.token("[");
                java.util.ArrayList<String> profiles=new java.util.ArrayList<>(),ids=new java.util.ArrayList<>();int selected=-1;
                do{int from=r.index;String id=ProtectedEnvelope.profile(r);if(active.equals(id))selected=profiles.size();ids.add(id);profiles.add(r.text.substring(from,r.index));}while(r.take(","));
                r.token("]");r.token("}");require(selected>=0);boolean adult="exit-child-mode".equals(action)||"switch-adult-profile".equals(action),registryChanged=false;
                if(adult)require(target.length==0);
                else{String proposal=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(target)).toString();
                    if("expand-access-settings".equals(action)&&proposal.startsWith("{\"profileId\":")){
                        ProtectedEnvelope.Cursor t=new ProtectedEnvelope.Cursor(proposal);t.field("profileId",true);String id=t.string();t.token("}");require(t.index==proposal.length()&&ids.contains(id)&&(!active.equals(id)||"adult".equals(originalMode)));registryChanged=!active.equals(id);active=id;
                    }else if("expand-access-settings".equals(action)&&proposal.startsWith("{\"createProfile\":")){
                        ProtectedEnvelope.Cursor c=new ProtectedEnvelope.Cursor(proposal);c.field("createProfile",true);int from=c.index;String id=ProtectedEnvelope.profile(c);String profile=proposal.substring(from,c.index);c.token("}");
                        require(c.index==proposal.length()&&id.matches("profile-[a-f0-9]{32}")&&profiles.size()<4&&!ids.contains(id));profiles.add(profile);ids.add(id);active=id;registryChanged=true;
                    }else{require("child".equals(originalMode)&&LocalV2InitialProfile.profileId(target).equals(active));java.util.Map<String,String> oldFields=profileFields(profiles.get(selected)),nextFields=profileFields(proposal);
                        java.util.HashSet<String> permitted=new java.util.HashSet<>();
                        if("change-exact-age".equals(action))permitted.addAll(Arrays.asList("exactAge","ageBand","ageConfirmedAt"));
                        else if("change-blocked-topics".equals(action))permitted.add("blockedTopics");
                        else permitted.addAll(Arrays.asList("readingLevel","allowedTopics","locale","soundEnabled","motion","narrationEnabled","localeLocked"));
                        java.util.HashSet<String> keys=new java.util.HashSet<>(oldFields.keySet());keys.addAll(nextFields.keySet());
                        for(String key:keys)if(!java.util.Objects.equals(oldFields.get(key),nextFields.get(key))){require(permitted.contains(key));registryChanged=true;}
                        require(registryChanged);profiles.set(selected,proposal);
                    }
                }
                String nextRegistry=oldRegistry;
                if(registryChanged){require(revision<MAX_SAFE);StringBuilder value=new StringBuilder("{\"schemaVersion\":1,\"policyVersion\":").append(LocalSnapshotV2.quoted(before.policy.version))
                        .append(",\"activeProfileId\":").append(LocalSnapshotV2.quoted(active)).append(",\"profiles\":[");
                    for(int i=0;i<profiles.size();i++){if(i>0)value.append(',');value.append(profiles.get(i));}nextRegistry=value.append("]}").toString();}
                registry=nextRegistry.getBytes(StandardCharsets.UTF_8);String sum=digest(registry);require(registryChanged||sum.equals(oldSum));
                String prefix="{\"schemaVersion\":2,\"revision\":"+(before.revision+1)+",\"mode\":"+LocalSnapshotV2.quoted(adult?"adult":"child")
                    +",\"selectionRevision\":"+(selection+1)+",\"profileRevision\":"+(revision+(registryChanged?1:0))+",\"policyChecksum\":"+LocalSnapshotV2.quoted(before.policy.checksum)
                    +",\"registryChecksum\":"+LocalSnapshotV2.quoted(sum)+",\"registry\":"+nextRegistry+",\"pin\":";
                protectedBytes=(prefix+new String(raw,before.pinStart,before.protectedEnd-before.pinStart,StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
                result=LocalSnapshotV2.wire(protectedBytes,before.policy,before.journalRevision+1,before.revision+1,before.pinRevision,before.credentialId,
                    before.count,before.pendingAttemptId,before.savedCooldownMs,before.lastObservedMs);
                try(LocalSnapshotV2 checked=LocalSnapshotV2.decode(result,before.policy)){}adopted=true;return new LocalV2CanonicalTransition(action,result,!adult);
            }finally{LocalSnapshotV2.wipe(raw);LocalSnapshotV2.wipe(registry);LocalSnapshotV2.wipe(protectedBytes);if(!adopted)LocalSnapshotV2.wipe(result);}
        }
        private static void validate(LocalSnapshotV2 before,LocalSnapshotV2 after,String action,byte[] target) throws Exception {
            LocalV2CanonicalTransition exact=prepare(before,action,target);byte[] actual=null;
            try{require(before.policy.version.equals(after.policy.version)&&before.policy.checksum.equals(after.policy.checksum)&&before.policy.maximumIterations==after.policy.maximumIterations
                    &&Arrays.equals(before.policy.delays,after.policy.delays));actual=after.copy();require(MessageDigest.isEqual(exact.bytes,actual));}
            finally{LocalSnapshotV2.wipe(exact.bytes);LocalSnapshotV2.wipe(actual);}
        }
    }

    /** Closed original PIN/Gate handoff into one concrete canonical mutation.
     * The same process clock/deadline stays occupied through actual canonical
     * write/readback/ACK, native action recipient and Gate worker retirement. */
    private static final class LocalV2GateMutation {
        final LocalV2GateHost host;final LocalV2GateInvocation original;final LocalV2PinReply reply;final byte[] target;
        private LocalV2ClockLease lease;private final Object ack=new Object();private byte[] next;private boolean wrote,known,recipientJoined,recipientSucceeded,retired;
        private LocalV2GateMutation(LocalV2GateHost host,LocalV2GateInvocation original,LocalV2PinReply reply,byte[] target) throws Exception {
            require(host!=null&&original!=null&&reply!=null&&target!=null);
            this.host=host;this.original=original;this.reply=reply;this.target=target.clone();proof();
        }
        private void proof() throws Exception {require(host.invocation==original&&host.operation==reply.operation&&reply.operation.request==host.request
            &&reply.gate==original.original&&reply.operation.originalChallenge==original&&reply.kind==LocalV2PinKind.verify
            &&reply.settled&&reply.consumed&&!reply.disposed&&reply.operation.knownSettlement&&reply.operation.finalAcknowledged&&reply.operation.platformCompared
            &&reply.outcome==PinVerificationOutcome.match&&!reply.operation.closedRevoked&&reply.operation.request.retired&&reply.operation.request.detached
            &&LocalV2CanonicalTransition.handles(original.action)&&digest(target).equals(original.targetChecksum));
            original.execution(reply,SystemClock.elapsedRealtime());if(host.revoked||retired)throw new PinKnownRefusal();if(host.closed)terminalJoined();}
        private void boundary() throws Exception {proof();require(lease!=null&&(Thread.currentThread()==host.worker
            ||Thread.currentThread()==host.retirement&&host.worker!=null&&!host.worker.isAlive()&&known));host.request.processClock.current(lease);}
        private byte[] packageBefore;private LocalV2DataContext previousContext,futureContext;private String territory;private long packageWallLast=-1;private boolean dataWrote;
        private LocalV2CompiledPackage compatible;private LocalV2DataAdmission admission;private PlanetChildDataStore dataStore;
        private long packageWall() throws Exception {boundary();long now=System.currentTimeMillis();require(now>=0&&now<=8640000000000000L&&now>=packageWallLast);packageWallLast=now;return now;}
        private void packageFresh() throws Exception {boundary();host.onMain(()->{host.current(false);return null;});host.writer.vault.locked(directory->{boundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);try{host.request.processClock.inspect(lease,actual);require(packageBefore!=null&&MessageDigest.isEqual(packageBefore,actual));try(LocalSnapshotV2 current=LocalSnapshotV2.decode(actual,host.policy)){require(previousContext.binding.equals(new LocalV2DataContext(current).binding));original.scope.same(current);}return null;}finally{LocalSnapshotV2.wipe(actual);}});}
        private void commitCanonical(File directory,byte[] before) throws Exception {boundary();LocalV2ProcessClock clock=host.request.processClock;clock.inspect(lease,before);try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,host.policy)){require(old.checksum.equals(reply.checksum));original.scope.same(old);try(LocalSnapshotV2 prepared=LocalSnapshotV2.decode(next,host.policy)){LocalV2CanonicalTransition.validate(old,prepared,original.action,target);}
            LocalV2ClockSample sample=clock.sample(lease,before);boundary();wrote=true;host.writer.vault.writeExact(directory,next,this::boundary);host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);try{boundary();require(MessageDigest.isEqual(next,actual));try(LocalSnapshotV2 after=LocalSnapshotV2.decode(actual,host.policy)){LocalV2CanonicalTransition.validate(old,after,original.action,target);}clock.stage(lease,ack,before,actual,sample,LocalV2ClockAction.canonical);}finally{LocalSnapshotV2.wipe(actual);}}
        }
        private void acknowledgeCanonical(File directory) throws Exception {boundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);try{require(MessageDigest.isEqual(next,actual));host.request.processClock.acknowledge(lease,ack,actual);known=true;boundary();}finally{LocalSnapshotV2.wipe(actual);}}
        private void perform() throws Exception {
            require(Thread.currentThread()==host.worker);proof();LocalV2ProcessClock clock=host.request.processClock;synchronized(clock){clock.closedReadback(host.request.processLease,reply.checksum);require(host.request.processLease.deadline==original.deadline);lease=clock.claimUntil(this,original.deadline);}
            try{host.onMain(()->{host.current(false);return null;});boolean needsPackage=host.writer.vault.locked(directory->{boundary();host.writer.completeRecord(directory);byte[] before=host.writer.vault.readExact(directory);try{clock.inspect(lease,before);try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,host.policy)){require(old.checksum.equals(reply.checksum));original.scope.same(old);LocalV2CanonicalTransition prepared=LocalV2CanonicalTransition.prepare(old,original.action,target);try{next=prepared.bytes.clone();previousContext=new LocalV2DataContext(old);try(LocalSnapshotV2 future=LocalSnapshotV2.decode(next,host.policy)){futureContext=new LocalV2DataContext(future);}
                            require(futureContext.profiles.size()==previousContext.profiles.size()+(original.generatedProfileId==null?0:1));if(original.generatedProfileId!=null)require(futureContext.active.equals(original.generatedProfileId)&&!previousContext.profiles.containsKey(original.generatedProfileId));
                            packageBefore=before.clone();if(!prepared.requiresPackage)prepared.requireAdultExit();return prepared.requiresPackage;}finally{LocalSnapshotV2.wipe(prepared.bytes);}}}finally{LocalSnapshotV2.wipe(before);}});
                if(needsPackage){territory=java.util.Locale.getDefault().getCountry();require(territory.matches("[A-Z]{2}"));LocalV2PackageProfile future;try(LocalSnapshotV2 prepared=LocalSnapshotV2.decode(next,host.policy)){future=new LocalV2PackageProfile(prepared);}compatible=new LocalV2FixedPackageProducer(this,future).compile();}
                admission=new LocalV2DataAdmission(this,compatible,previousContext);packageFresh();host.writer.vault.locked(directory->{boundary();byte[] actual=host.writer.vault.readExact(directory);try{clock.inspect(lease,actual);require(MessageDigest.isEqual(packageBefore,actual));admission.enter(directory,actual);try{dataStore=new PlanetChildDataStore(host.writer.vault.context);dataStore.migrate(admission);}finally{admission.leave();}return null;}finally{LocalSnapshotV2.wipe(actual);}});
                host.onMain(()->{host.current(false);return null;});host.writer.vault.locked(directory->{boundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);try{require(MessageDigest.isEqual(next,actual));if(admission!=null){admission.enter(directory,actual);try{dataStore.migrationReadback(admission);}finally{admission.leave();}}else acknowledgeCanonical(directory);return null;}finally{LocalSnapshotV2.wipe(actual);}});
            }catch(Throwable failure){if(wrote||dataWrote)clock.invalidate(lease);if(failure instanceof Error)throw(Error)failure;throw failure instanceof Exception?(Exception)failure:new Unavailable();}
            finally{LocalSnapshotV2.wipe(packageBefore);packageBefore=null;}
        }
        private void publishRetired() throws Exception {
            require(Thread.currentThread()==host.retirement&&host.worker!=null&&!host.worker.isAlive());if(!known)return;
            try{host.onMain(()->{host.current(false);return null;});host.writer.vault.locked(directory->{boundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);
                    try{require(MessageDigest.isEqual(next,actual));host.request.processClock.inspect(lease,actual);return null;}finally{LocalSnapshotV2.wipe(actual);}});
                // The canonical worker has ACTUALLY returned before the exact
                // original action recipient may observe the known mutation.
                host.onMain(()->{host.current(false);proof();host.request.processClock.current(lease);try{host.dispatch.perform(original.action,target);recipientSucceeded=true;}finally{recipientJoined=true;}return null;});
                host.writer.vault.locked(directory->{boundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);
                    try{require(recipientJoined&&MessageDigest.isEqual(next,actual));host.request.processClock.inspect(lease,actual);return null;}finally{LocalSnapshotV2.wipe(actual);}});
            }catch(Throwable failure){host.request.processClock.invalidate(lease);if(failure instanceof Error)throw(Error)failure;throw failure instanceof Exception?(Exception)failure:new Unavailable();}
        }
        /** Original worker and main-thread detachment have actually returned. */
        private void terminalJoined() throws Exception {
            require(Thread.currentThread()==host.retirement&&host.worker!=null&&!host.worker.isAlive()&&known&&recipientJoined&&recipientSucceeded
                &&host.closed&&!host.revoked&&host.lifecycle==null&&host.screen==null&&host.back==null&&host.attachment==null&&host.focus==null&&host.layout==null&&host.expiry==null
                &&host.request.retired&&host.request.detached&&!host.request.sealed&&host.request.receipt==null&&!host.request.unacknowledgedMutation
                &&host.request.events==0&&host.request.mainCalls==0&&host.request.pinCancelCalls==0
                &&host.operation.finished&&host.operation.worker!=null&&!host.operation.worker.isAlive()&&host.operation.cancelWorker==null
                &&host.operation.closedLifecycle==null&&host.operation.closedScreen==null&&host.operation.closedExpiry==null);
        }
        private void completionBoundary() throws Exception {terminalJoined();boundary();}
        private void retirement() throws Exception {
            require(Thread.currentThread()==host.retirement&&host.worker!=null&&!host.worker.isAlive());
            try{
                completionBoundary();require(admission!=null&&dataStore!=null);
                host.writer.vault.locked(directory->{completionBoundary();host.writer.completeRecord(directory);byte[] actual=host.writer.vault.readExact(directory);
                    try{require(MessageDigest.isEqual(next,actual));host.request.processClock.inspect(lease,actual);admission.enter(directory,actual);
                        try{dataStore.migrationComplete(admission);}finally{admission.leave();}return null;
                    }finally{LocalSnapshotV2.wipe(actual);}});
                // All joins, durable terminal bytes and readback preceded the
                // final pending removal. Only mechanical in-memory release remains.
                admission.revoke();if(compatible!=null)compatible.close();dataStore=null;
                host.request.processClock.release(lease);retired=true;LocalSnapshotV2.wipe(next);LocalSnapshotV2.wipe(target);
            }catch(Throwable failure){if(lease!=null)host.request.processClock.invalidate(lease);
                // Keep the original occupied lane and durable pending marker.
                if(failure instanceof Error)throw(Error)failure;throw failure instanceof Exception?(Exception)failure:new Unavailable();}
        }
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
    /** Signed original birth plus encrypted, native-published known terminal.
     * Parsing is structural. Current hardware owner key and exact original
     * before/after/PIN/J/profile/data identity are verified before reuse. */
    static final class LocalV2KnownBirth {
        final String identity,nonce,emptyChecksum,profileId,policyVersion,policyChecksum,contentBinding,claimChecksum;
        private LocalV2KnownBirth(String identity,String nonce,String empty,String profile,String version,String policy,String content,String claim){
            this.identity=identity;this.nonce=nonce;emptyChecksum=empty;profileId=profile;policyVersion=version;policyChecksum=policy;contentBinding=content;claimChecksum=claim;}
        private static byte[] b64(Object v,int max) throws Exception {String s=LocalV2PackageJson.text(v);require(s.length()<=max*2&&s.matches("[A-Za-z0-9+/]*={0,2}"));
            byte[] value=android.util.Base64.decode(s,android.util.Base64.NO_WRAP);try{require(value.length>0&&value.length<=max&&android.util.Base64.encodeToString(value,android.util.Base64.NO_WRAP).equals(s));return value;}catch(Exception failure){LocalSnapshotV2.wipe(value);throw failure;}}
        private static String[] fields(byte[] bytes) throws Exception {String value=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            String prefix="LP-LOCAL-V2-FIRST-PROFILE\0v2\0";require(value.startsWith(prefix));int at=prefix.length();String[] fields=new String[19];
            for(int i=0;i<fields.length;i++){int end=value.indexOf(':',at);require(end>at&&end-at<=6);String length=value.substring(at,end);require(length.matches("0|[1-9][0-9]*"));int n=Integer.parseInt(length);require(n<=8192&&end+1<=value.length()-n);fields[i]=value.substring(end+1,end+1+n);at=end+1+n;}require(at==value.length());return fields;}
        private static long[] delays(String input) throws Exception {require(input.startsWith("[")&&input.endsWith("]"));String[] parts=input.substring(1,input.length()-1).split(", ",-1);require(parts.length>=1&&parts.length<=64);long[] result=new long[parts.length];for(int i=0;i<parts.length;i++){require(parts[i].matches("[1-9][0-9]*"));result[i]=Long.parseLong(parts[i]);}return result;}
        static LocalV2KnownBirth verify(Context context,String identity,byte[] plain) throws Exception {
            require(context!=null&&identity!=null);java.util.Map<String,Object> m=LocalV2PackageJson.object(LocalV2PackageJson.read(plain,262144),"schemaVersion","kind","identity","nonce","emptyChecksum","profileId","profile","before","after","payload","signature","keyEncoding","claimChecksum");
            require(Long.valueOf(1).equals(m.get("schemaVersion"))&&"LP-LOCAL-V2-KNOWN-BIRTH".equals(m.get("kind"))&&identity.equals(m.get("identity")));
            byte[] profile=null,before=null,after=null,payload=null,signature=null,key=null;
            try{profile=b64(m.get("profile"),65536);before=b64(m.get("before"),131072);after=b64(m.get("after"),131072);payload=b64(m.get("payload"),16384);signature=b64(m.get("signature"),80);key=b64(m.get("keyEncoding"),512);require(signature.length>=8);
                String[] f=fields(payload);String id=LocalV2PackageJson.hash(f[0]),uid=LocalV2InitialProfile.profileId(profile),nonce=LocalV2PackageJson.text(m.get("nonce")),empty=LocalV2PackageJson.hash(m.get("emptyChecksum"));
                require(f[1].equals("create-initial-local-profile")&&f[2].equals(digest(before))&&f[3].equals(digest(after))&&f[4].equals(digest(profile))&&f[5].equals(identity)&&f[6].equals(nonce)
                    &&nonce.equals(id.substring(32))&&f[7].equals(empty)&&uid.equals("child-"+id.substring(0,32))&&uid.equals(m.get("profileId"))&&f[18].equals(id)&&f[17].equals(digest(key)));
                String alias=context.getPackageName()+".literary-planet-child-device-owner-sign-v1";require(alias.equals(f[16])&&android.os.Build.VERSION.SDK_INT>=30);
                KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);java.security.Key owner=keys.getKey(alias,null);require(owner instanceof java.security.PrivateKey&&owner.getEncoded()==null);
                android.security.keystore.KeyInfo info=java.security.KeyFactory.getInstance("EC","AndroidKeyStore").getKeySpec(owner,android.security.keystore.KeyInfo.class);
                require(alias.equals(info.getKeystoreAlias())&&info.getKeySize()==256&&info.getOrigin()==android.security.keystore.KeyProperties.ORIGIN_GENERATED
                    &&info.getPurposes()==android.security.keystore.KeyProperties.PURPOSE_SIGN&&info.isUserAuthenticationRequired()&&info.getUserAuthenticationValidityDurationSeconds()==-1
                    &&info.getUserAuthenticationType()==android.security.keystore.KeyProperties.AUTH_DEVICE_CREDENTIAL&&info.isInsideSecureHardware()&&info.isUserAuthenticationRequirementEnforcedBySecureHardware()
                    &&info.getDigests().length==1&&android.security.keystore.KeyProperties.DIGEST_SHA256.equals(info.getDigests()[0]));
                java.security.cert.Certificate certificate=keys.getCertificate(alias);require(certificate!=null);byte[] current=certificate.getPublicKey().getEncoded();try{require(MessageDigest.isEqual(current,key));}finally{LocalSnapshotV2.wipe(current);}
                java.security.Signature verify=java.security.Signature.getInstance("SHA256withECDSA");verify.initVerify(certificate.getPublicKey());verify.update(payload);require(verify.verify(signature));
                LocalSnapshotV2Policy policy=new LocalSnapshotV2Policy(f[8],f[9],Long.parseLong(f[10]),delays(f[11]));long began=Long.parseLong(f[12]),deadline=Long.parseLong(f[13]);require(began>=0&&deadline>began&&deadline-began<=60000);
                try(LocalSnapshotV2 old=LocalSnapshotV2.decode(before,policy);LocalSnapshotV2 saved=LocalSnapshotV2.decode(after,policy)){
                    LocalV2InitialProfile.validate(old,saved);LocalV2DataContext contextBinding=new LocalV2DataContext(saved);require(contextBinding.profiles.size()==1&&contextBinding.active.equals(uid));
                    byte[] expected=LocalV2InitialProfile.create(old,profile);try{require(MessageDigest.isEqual(expected,after));}finally{LocalSnapshotV2.wipe(expected);}
                    String claim=digest(("LP-LOCAL-V2-DATA-BIRTH\n"+identity+"\n"+nonce+"\n"+empty+"\n"+digest(payload)+"\n").getBytes(StandardCharsets.US_ASCII));require(claim.equals(m.get("claimChecksum")));
                    return new LocalV2KnownBirth(identity,nonce,empty,uid,policy.version,policy.checksum,contextBinding.profiles.get(uid),claim);
                }
            }finally{LocalSnapshotV2.wipe(profile);LocalSnapshotV2.wipe(before);LocalSnapshotV2.wipe(after);LocalSnapshotV2.wipe(payload);LocalSnapshotV2.wipe(signature);LocalSnapshotV2.wipe(key);}
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
        void dataCompletionBoundary() throws Exception {exact(original.data.identity,original.data.nonce,original.data.checksum);require(original.phase==LocalV2ProfilePhase.closed&&original.delivered&&original.uiJoined&&original.ownerReturned
            &&original.request.retired&&original.request.detached&&original.request.receipt==null&&!original.request.unacknowledgedMutation&&!original.worker.isAlive()&&original.cancelWorker==null
            &&original.request.events==0&&original.request.mainCalls==0&&original.request.pinCancelCalls==0&&original.closingLifecycle==null&&original.closingScreen==null&&original.closingExpiry==null);}
        byte[] dataKnownReceipt() throws Exception {dataCompletionBoundary();java.util.LinkedHashMap<String,Object> value=new java.util.LinkedHashMap<>();value.put("schemaVersion",1L);value.put("kind","LP-LOCAL-V2-KNOWN-BIRTH");
            value.put("identity",original.data.identity);value.put("nonce",original.data.nonce);value.put("emptyChecksum",original.data.checksum);value.put("profileId",LocalV2InitialProfile.profileId(original.profile));
            for(String key:new String[]{"profile","before","after","payload","signature","keyEncoding"}){byte[] bytes=key.equals("profile")?original.profile:key.equals("before")?original.before:key.equals("after")?original.next:key.equals("payload")?original.payload:key.equals("signature")?original.signature:original.keyEncoding;value.put(key,android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP));}
            byte[] marker=dataMarker(original.data.identity,original.data.nonce,original.data.checksum);try{value.put("claimChecksum",digest(marker));}finally{LocalSnapshotV2.wipe(marker);}
            byte[] bytes=LocalV2PackageJson.bytes(value,false);try{require(bytes.length<=262144);LocalV2KnownBirth.verify(original.writer.vault.context,original.data.identity,bytes);return bytes;}catch(Exception failure){LocalSnapshotV2.wipe(bytes);throw failure;}}
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
        private static LocalV2ProfileOperation start(PlanetChildVault vault,android.app.Activity host,LocalSnapshotV2Policy policy,byte[] proposal,long timeout,LocalV2ProfileRecipient recipient) throws Exception {return startWithDeadline(vault,host,policy,proposal,timeout,0,recipient);}
        private static LocalV2ProfileOperation startAt(PlanetChildVault vault,android.app.Activity host,LocalSnapshotV2Policy policy,byte[] proposal,long deadline,LocalV2ProfileRecipient recipient) throws Exception {return startWithDeadline(vault,host,policy,proposal,1,deadline,recipient);}
        private static LocalV2ProfileOperation startWithDeadline(PlanetChildVault vault,android.app.Activity host,LocalSnapshotV2Policy policy,byte[] proposal,long timeout,long deadline,LocalV2ProfileRecipient recipient) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&recipient!=null&&proposal!=null);byte[] owned=proposal.clone();LocalV2Writer writer=new LocalV2Writer(vault);
            LocalV2Request request=writer.requestAt(host,policy,timeout,deadline);LocalV2ProfileOperation operation;
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
        private void boundary() throws Exception {require(publicationThread==Thread.currentThread());if(phase==LocalV2ProfilePhase.closed){require(writer.active==request&&request.retired&&request.detached&&!request.processLease.closed);request.processClock.inspect(request.processLease,next);require(!cancelled&&!request.sealed);}
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
                    if(android.os.Build.VERSION.SDK_INT>=33)writer.vault.context.registerReceiver(closingScreen,filter,android.content.Context.RECEIVER_NOT_EXPORTED);else writer.vault.context.registerReceiver(closingScreen,filter);
                    closingExpiry=()->cancelled=true;require(writer.main.postDelayed(closingExpiry,Math.max(1,request.deadline-SystemClock.elapsedRealtime())));
                }else{try{if(closingLifecycle!=null)app.unregisterActivityLifecycleCallbacks(closingLifecycle);}finally{try{if(closingScreen!=null)writer.vault.context.unregisterReceiver(closingScreen);}
                    finally{if(closingExpiry!=null)writer.main.removeCallbacks(closingExpiry);closingLifecycle=null;closingScreen=null;closingExpiry=null;}}}return null;
            });require(writer.main.post(task));boolean interrupted=false;for(;;)try{task.get();break;}catch(InterruptedException ignored){interrupted=true;}
            if(interrupted){Thread.currentThread().interrupt();throw new PinKnownRefusal();}
        }
        private void settle(){try{worker.join();joinCancel();live();require(delivered&&phase==LocalV2ProfilePhase.profileKnown&&request.receipt==null&&!request.unacknowledgedMutation);
                writer.host(request);publicationThread=Thread.currentThread();birth.readback(permit);closingObservers(true);writer.retireProfile(this);phase=LocalV2ProfilePhase.closed;
                java.util.concurrent.FutureTask<Boolean> current=new java.util.concurrent.FutureTask<>(()->!cancelled&&!request.activity.isFinishing()&&!request.activity.isDestroyed()&&request.activity.hasWindowFocus()
                    &&request.activity.getWindow().getDecorView().getWindowToken()==request.token);require(writer.main.post(current));require(current.get());
                writer.vault.locked(directory->{boundary();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(actual,next));birth.readback(permit);boundary();return null;}finally{LocalSnapshotV2.wipe(actual);}});
                closingObservers(false);LocalV2ProfileCompletion preparedCompletion=new LocalV2ProfileCompletion(this);writer.vault.locked(directory->{boundary();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(actual,next));birth.complete(permit);return null;}finally{LocalSnapshotV2.wipe(actual);}});
                completion=preparedCompletion;
            }catch(Throwable failure){revoke();if(birth!=null&&request.retired)try{writer.vault.locked(directory->{birth.retainUnknownCompletion();return null;});}catch(Throwable sticky){failure.addSuppressed(sticky);writer.unknown(request);}if(!request.retired)try{writer.cancel(request);writer.retire(request);}catch(Throwable ignored){writer.unknown(request);}}
            finally{try{if(closingLifecycle!=null||closingScreen!=null||closingExpiry!=null)closingObservers(false);}catch(Throwable failure){completion=null;cancelled=true;}try{writer.releaseProfileRetirement(this);}catch(Throwable failure){completion=null;cancelled=true;request.processClock.invalidate(request.processLease);}if(data!=null)data.close();LocalSnapshotV2.wipe(before);LocalSnapshotV2.wipe(next);LocalSnapshotV2.wipe(payload);LocalSnapshotV2.wipe(signature);LocalSnapshotV2.wipe(keyEncoding);LocalSnapshotV2.wipe(profile);LocalSnapshotV2.wipe(nonce);}}
        private LocalV2ProfileCompletion completion() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()&&Thread.currentThread()!=worker&&Thread.currentThread()!=settler);settler.join();
            synchronized(writer){boolean available=!completionConsumed;completionConsumed=true;require(available&&completion!=null&&!cancelled&&!request.sealed);
                request.processClock.closedReadback(request.processLease,completion.snapshotChecksum);return completion;}}
        private void sdkCleanupJoined() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()&&settler!=null);settler.join();require(request.retired&&!request.sealed&&!request.processClock.invalid&&finished&&worker!=null&&!worker.isAlive()&&cancelWorker==null);}
        private void sdkJoin() throws Exception {sdkCleanupJoined();require(completion!=null&&delivered&&!cancelled);}    }
    /** Strict data parser shared by the package/review/catalog leaves. No
     * Android JSON stubs, coerced numbers, duplicate escaped fields or URLs. */
    private static final class LocalV2PackageJson {
        final String source;int offset,nodes;
        private LocalV2PackageJson(byte[] bytes,int limit) throws Exception {require(bytes!=null&&bytes.length>0&&bytes.length<=limit);
            source=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}
        static Object read(byte[] bytes,int limit) throws Exception {LocalV2PackageJson p=new LocalV2PackageJson(bytes,limit);Object result=p.value(0);p.white();require(p.offset==p.source.length());return result;}
        void white(){while(offset<source.length()&&" \t\r\n".indexOf(source.charAt(offset))>=0)offset++;}
        boolean take(char c){white();if(offset<source.length()&&source.charAt(offset)==c){offset++;return true;}return false;}
        Object value(int depth) throws Exception {require(depth<=16&&++nodes<=600000);white();require(offset<source.length());char c=source.charAt(offset);
            if(c=='"')return string();if(c=='{'){offset++;java.util.LinkedHashMap<String,Object> m=new java.util.LinkedHashMap<>();if(take('}'))return m;
                do{white();require(offset<source.length()&&source.charAt(offset)=='"');String key=string();require(!m.containsKey(key)&&take(':'));m.put(key,value(depth+1));}while(take(','));require(take('}'));return m;}
            if(c=='['){offset++;java.util.ArrayList<Object> a=new java.util.ArrayList<>();if(take(']'))return a;do{a.add(value(depth+1));}while(take(','));require(take(']'));return a;}
            for(String word:new String[]{"true","false","null"})if(source.startsWith(word,offset)){offset+=word.length();return word.equals("null")?null:Boolean.valueOf(word);}
            int start=offset;if(c=='-')offset++;require(offset<source.length());if(source.charAt(offset)=='0')offset++;else{require(source.charAt(offset)>='1'&&source.charAt(offset)<='9');while(offset<source.length()&&source.charAt(offset)>='0'&&source.charAt(offset)<='9')offset++;}
            String number=source.substring(start,offset);require(!number.equals("-0"));long result=Long.parseLong(number);require(result>=-MAX_SAFE&&result<=MAX_SAFE);return Long.valueOf(result);
        }
        String string() throws Exception {require(source.charAt(offset++)=='"');StringBuilder b=new StringBuilder();boolean ended=false;
            while(offset<source.length()){char c=source.charAt(offset++);if(c=='"'){ended=true;break;}require(c>=32);
                if(c=='\\'){require(offset<source.length());c=source.charAt(offset++);switch(c){case '"':case '\\':case '/':break;case 'b':c='\b';break;case 'f':c='\f';break;case 'n':c='\n';break;case 'r':c='\r';break;case 't':c='\t';break;
                    case 'u':require(offset+4<=source.length());int n=0;for(int i=0;i<4;i++){char digit=source.charAt(offset++);require(digit>='0'&&digit<='9'||digit>='a'&&digit<='f'||digit>='A'&&digit<='F');int h=Character.digit(digit,16);n=n*16+h;}c=(char)n;break;default:throw new PinKnownRefusal();}}
                b.append(c);}
            require(ended);String result=b.toString();for(int i=0;i<result.length();i++){char c=result.charAt(i);if(Character.isHighSurrogate(c)){require(i+1<result.length()&&Character.isLowSurrogate(result.charAt(++i)));}else require(!Character.isLowSurrogate(c));}return result;
        }
        @SuppressWarnings("unchecked") static java.util.Map<String,Object> object(Object v,String...keys) throws Exception {require(v instanceof java.util.Map);java.util.Map<String,Object> m=(java.util.Map<String,Object>)v;
            if(keys.length>0){require(m.size()==keys.length);for(String k:keys)require(m.containsKey(k));}return m;}
        @SuppressWarnings("unchecked") static java.util.List<Object> array(Object v,int max) throws Exception {require(v instanceof java.util.List&&((java.util.List<?>)v).size()<=max);return(java.util.List<Object>)v;}
        static String text(Object v) throws Exception {require(v instanceof String);return(String)v;}
        static long number(Object v,long min,long max) throws Exception {require(v instanceof Long);long n=(Long)v;require(n>=min&&n<=max);return n;}
        static boolean bool(Object v) throws Exception {require(v instanceof Boolean);return(Boolean)v;}
        static String identifier(Object v) throws Exception {String s=text(v);require(s.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));return s;}
        static String hash(Object v) throws Exception {String s=text(v);require(s.matches("[a-f0-9]{64}"));return s;}
        static String json(Object v,boolean sorted) throws Exception {if(v==null)return"null";if(v instanceof String)return quote((String)v);if(v instanceof Long||v instanceof Boolean)return v.toString();
            if(v instanceof java.util.List){StringBuilder b=new StringBuilder("[");for(Object x:(java.util.List<?>)v){if(b.length()>1)b.append(',');b.append(json(x,sorted));}return b.append(']').toString();}
            java.util.Map<String,Object> m=object(v);java.util.ArrayList<String> keys=new java.util.ArrayList<>(m.keySet());if(sorted)java.util.Collections.sort(keys);StringBuilder b=new StringBuilder("{");for(String k:keys){if(b.length()>1)b.append(',');b.append(quote(k)).append(':').append(json(m.get(k),sorted));}return b.append('}').toString();}
        static String quote(String s){StringBuilder b=new StringBuilder("\"");for(int i=0;i<s.length();i++){char c=s.charAt(i);switch(c){case '"':b.append("\\\"");break;case '\\':b.append("\\\\");break;case '\b':b.append("\\b");break;case '\f':b.append("\\f");break;case '\n':b.append("\\n");break;case '\r':b.append("\\r");break;case '\t':b.append("\\t");break;default:if(c<32)b.append(String.format(java.util.Locale.ROOT,"\\u%04x",(int)c));else b.append(c);}}return b.append('"').toString();}
        static byte[] bytes(Object v,boolean sorted) throws Exception {return json(v,sorted).getBytes(StandardCharsets.UTF_8);}
        static java.util.Set<String> strings(Object v,int max,String expression) throws Exception {java.util.HashSet<String> result=new java.util.HashSet<>();for(Object x:array(v,max)){String s=text(x);require(s.matches(expression)&&result.add(s));}return result;}
    }
    /** Actual mode/full registry binding, independent of package admission.
     * Unknown sibling seals cannot be adopted into this canonical context. */
    private static final class LocalV2DataContext {
        final String binding,mode,active;final long selection,revision;final java.util.Map<String,String> profiles;
        private LocalV2DataContext(LocalSnapshotV2 saved) throws Exception {byte[] bytes=saved.copy();try{
            java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,MAX_BYTES)),p=LocalV2PackageJson.object(root.get("protectedRecord"));
            java.util.LinkedHashMap<String,Object> context=new java.util.LinkedHashMap<>();for(String key:new String[]{"mode","selectionRevision","profileRevision","policyChecksum","registryChecksum","registry"})context.put(key,p.get(key));
            byte[] encoded=LocalV2PackageJson.bytes(context,true);try{binding=digest(encoded);}finally{LocalSnapshotV2.wipe(encoded);}
            mode=LocalV2PackageJson.text(p.get("mode"));selection=LocalV2PackageJson.number(p.get("selectionRevision"),1,MAX_SAFE);revision=LocalV2PackageJson.number(p.get("profileRevision"),1,MAX_SAFE);
            java.util.Map<String,Object> registry=LocalV2PackageJson.object(p.get("registry"));active=LocalV2PackageJson.identifier(registry.get("activeProfileId"));java.util.LinkedHashMap<String,String> known=new java.util.LinkedHashMap<>();
            for(Object x:LocalV2PackageJson.array(registry.get("profiles"),4)){java.util.Map<String,Object> profile=LocalV2PackageJson.object(x);String id=LocalV2PackageJson.identifier(profile.get("id"));
                java.util.LinkedHashMap<String,Object> content=new java.util.LinkedHashMap<>();content.put("profile",profile);content.put("policyVersion",saved.policy.version);content.put("policyChecksum",saved.policy.checksum);
                byte[] encodedContent=LocalV2PackageJson.bytes(content,true);try{require(known.put(id,digest(encodedContent))==null);}finally{LocalSnapshotV2.wipe(encodedContent);}}
            require(known.containsKey(active));profiles=java.util.Collections.unmodifiableMap(known);
        }finally{LocalSnapshotV2.wipe(bytes);}}
        private void seals(java.util.Map<String,String> seals) throws Exception {require(seals!=null&&!seals.isEmpty()&&seals.size()==profiles.size());for(java.util.Map.Entry<String,String> seal:seals.entrySet())require(java.util.Objects.equals(profiles.get(seal.getKey()),seal.getValue()));}
    }
    /** This scope is extracted only after the existing strict canonical V2
     * decoder verifies every coupled PIN/J/clock/registry checksum. */
    private static final class LocalV2PackageProfile {
        final String recordChecksum,id,locale,policyVersion,policyChecksum,reading,contextBinding;final long revision,selectionRevision,exactAge;
        final java.util.Set<String> allowed,blocked;final java.util.Map<String,Object> profile;
        private LocalV2PackageProfile(LocalSnapshotV2 saved) throws Exception {byte[] bytes=saved.copy();try{
            java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,MAX_BYTES)),p=LocalV2PackageJson.object(root.get("protectedRecord"));
            java.util.LinkedHashMap<String,Object> context=new java.util.LinkedHashMap<>();for(String key:new String[]{"mode","selectionRevision","profileRevision","policyChecksum","registryChecksum","registry"})context.put(key,p.get(key));byte[] contextBytes=LocalV2PackageJson.bytes(context,true);try{contextBinding=digest(contextBytes);}finally{LocalSnapshotV2.wipe(contextBytes);}
            require("child".equals(p.get("mode")));recordChecksum=saved.checksum;policyVersion=saved.policy.version;policyChecksum=saved.policy.checksum;
            revision=LocalV2PackageJson.number(p.get("profileRevision"),1,MAX_SAFE);selectionRevision=LocalV2PackageJson.number(p.get("selectionRevision"),1,MAX_SAFE);
            java.util.Map<String,Object> r=LocalV2PackageJson.object(p.get("registry"));id=LocalV2PackageJson.identifier(r.get("activeProfileId"));java.util.Map<String,Object> selected=null;
            for(Object x:LocalV2PackageJson.array(r.get("profiles"),4)){java.util.Map<String,Object> item=LocalV2PackageJson.object(x);if(id.equals(item.get("id"))){require(selected==null);selected=item;}}
            require(selected!=null);profile=selected;exactAge=LocalV2PackageJson.number(selected.get("exactAge"),3,17);locale=LocalV2PackageJson.text(selected.get("locale"));require(locale.equals("ru")||locale.equals("en"));
            Object level=selected.get("readingLevel");reading=level==null?null:LocalV2PackageJson.text(level);require(reading==null||java.util.Arrays.asList("plain","developing","fluent").contains(reading));
            allowed=selected.get("allowedTopics")==null?null:LocalV2PackageJson.strings(selected.get("allowedTopics"),64,"[a-z0-9][a-z0-9._-]{0,63}");blocked=LocalV2PackageJson.strings(selected.get("blockedTopics"),64,"[a-z0-9][a-z0-9._-]{0,63}");
        }finally{LocalSnapshotV2.wipe(bytes);}}
        void same(LocalSnapshotV2 current) throws Exception {require(recordChecksum.equals(current.checksum));}
    }
    /** Owned text/reference index. It cannot grant storage admission. Each
     * payload is copied and exact hash-checked; close wipes all owned arrays. */
    private static final class LocalV2CompiledPackage implements AutoCloseable {
        final LocalV2PackageProfile profile;final String packageId,checksum,reviewChecksum,platform,territory,home;final long version,until;
        private final java.util.LinkedHashMap<String,byte[]> payloads;private boolean closed;
        private LocalV2CompiledPackage(LocalV2PackageProfile profile,String id,long version,String checksum,String review,String platform,String territory,String home,long until,java.util.LinkedHashMap<String,byte[]> payloads){
            this.profile=profile;packageId=id;this.version=version;this.checksum=checksum;reviewChecksum=review;this.platform=platform;this.territory=territory;this.home=home;this.until=until;this.payloads=payloads;}
        private synchronized byte[] copy(String key,long now) throws Exception {require(!closed&&now>=0&&now<until);byte[] value=payloads.get(key);require(value!=null);return value.clone();}
        private synchronized String migrationReference(String key,String expectedHash,long now) throws Exception {require(!closed&&now>=0&&now<until);if(!payloads.containsKey(key))return null;byte[] value=payloads.get(key);require(value!=null);return digest(value).equals(expectedHash)?key:null;}
        public synchronized void close(){closed=true;for(byte[] value:payloads.values())LocalSnapshotV2.wipe(value);payloads.clear();}
    }
    private static final class LocalV2PackageCompiler {
        private interface Fence {void check() throws Exception;}
        private static final String[] ROOT={"schemaVersion","namespace","packageId","packageVersion","locale","exactAge","policyVersion","policyChecksum","validFromEpochMs","validUntilEpochMs","home","entities"};
        private static final String[] POLICY={"id","kind","sourceVersion","policyVersion","minAge","maxAge","reviewStatus","localizedContent","topics","topicTagsComplete","commercialAvailability","rights"};
        private static final String[] REVIEW={"schemaVersion","kind","keyId","reviewerId","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","readingLevels","platforms","territories","reviewedAtEpochMs","validFromEpochMs","validUntilEpochMs","entityPolicyChecksums","signatureHex"};
        private static final java.util.Set<String> KINDS=new java.util.HashSet<>(java.util.Arrays.asList("country","writer","biography","work","character","storyworld","fact","quote","activity","quiz","search-result","recommendation","favorite","recent","offline-package","deep-link"));
        private static final java.util.Set<String> PLATFORMS=new java.util.HashSet<>(java.util.Arrays.asList("android-google","android-rustore","ios-ipados"));
        private static String ref(Object value) throws Exception {java.util.Map<String,Object> m=LocalV2PackageJson.object(value,"kind","id","contentChecksum");String k=LocalV2PackageJson.text(m.get("kind"));require(KINDS.contains(k));return k+"/"+LocalV2PackageJson.identifier(m.get("id"));}
        private static long epoch(Object value) throws Exception{return LocalV2PackageJson.number(value,0,8640000000000000L);}
        private static boolean jsWhite(char c){return c>=9&&c<=13||c==32||c==160||c==5760||c>=8192&&c<=8202||c==8232||c==8233||c==8239||c==8287||c==12288||c==65279;}
        private static String trim(String s){int a=0,b=s.length();while(a<b&&jsWhite(s.charAt(a)))a++;while(b>a&&jsWhite(s.charAt(b-1)))b--;return s.substring(a,b);}
        private static void window(java.util.Map<String,Object> m,String from,String until,long now) throws Exception {long a=epoch(m.get(from)),b=epoch(m.get(until));require(a<b&&a<=now&&now<b);}
        private static byte[] payload(Object value) throws Exception {java.util.Map<String,Object> m=LocalV2PackageJson.object(value,"title","text","terms","references");String title=LocalV2PackageJson.text(m.get("title")),text=LocalV2PackageJson.text(m.get("text"));
            require(title.length()<=240&&!title.isEmpty()&&title.equals(trim(title))&&!title.matches("(?s).*[\\x00-\\x1f\\x7f].*"));require(text.length()<=32768&&!text.matches("(?s).*[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f].*"));
            java.util.HashSet<String> terms=new java.util.HashSet<>();for(Object term:LocalV2PackageJson.array(m.get("terms"),64)){String t=LocalV2PackageJson.text(term);require(t.length()>0&&t.length()<=80&&t.equals(trim(t))&&!t.matches("(?s).*[\\x00-\\x1f\\x7f].*")&&terms.add(t));}
            java.util.LinkedHashMap<String,Object> out=new java.util.LinkedHashMap<>();out.put("title",title);out.put("text",text);out.put("terms",m.get("terms"));java.util.ArrayList<Object> refs=new java.util.ArrayList<>();java.util.HashSet<String> seen=new java.util.HashSet<>();
            for(Object entry:LocalV2PackageJson.array(m.get("references"),64)){String key=ref(entry);require(seen.add(key));java.util.Map<String,Object> r=LocalV2PackageJson.object(entry);java.util.LinkedHashMap<String,Object> canonical=new java.util.LinkedHashMap<>();canonical.put("kind",r.get("kind"));canonical.put("id",r.get("id"));canonical.put("contentChecksum",LocalV2PackageJson.hash(r.get("contentChecksum")));refs.add(canonical);}out.put("references",refs);return LocalV2PackageJson.bytes(out,false);
        }
        private static void policy(java.util.Map<String,Object> m,LocalV2PackageProfile profile,String platform,String territory,long now,String payloadHash) throws Exception {policyForKinds(m,profile,platform,territory,now,payloadHash,KINDS);}
            private static void policyForKinds(java.util.Map<String,Object> m,LocalV2PackageProfile profile,String platform,String territory,long now,String payloadHash,java.util.Set<String> kinds) throws Exception { LocalV2PackageJson.object(m,POLICY);require(kinds.contains(LocalV2PackageJson.text(m.get("kind")))&&LocalV2PackageJson.identifier(m.get("id"))!=null&&LocalV2PackageJson.identifier(m.get("sourceVersion"))!=null
                &&profile.policyVersion.equals(m.get("policyVersion"))&&"approved".equals(m.get("reviewStatus"))&&LocalV2PackageJson.bool(m.get("topicTagsComplete"))&&"included-in-base".equals(m.get("commercialAvailability")));
            long min=LocalV2PackageJson.number(m.get("minAge"),3,17),max=LocalV2PackageJson.number(m.get("maxAge"),3,17);require(min<=max&&min<=profile.exactAge&&profile.exactAge<=max);
            java.util.Set<String> topics=LocalV2PackageJson.strings(m.get("topics"),64,"[a-z0-9][a-z0-9._-]{0,63}");for(String topic:topics)require(!profile.blocked.contains(topic)&&(profile.allowed==null||profile.allowed.contains(topic)));
            java.util.List<Object> localized=LocalV2PackageJson.array(m.get("localizedContent"),1);require(localized.size()==1);java.util.Map<String,Object> locale=LocalV2PackageJson.object(localized.get(0),"locale","contentChecksum","reviewStatus","available","reviewerId","reviewedAt");
            require(profile.locale.equals(locale.get("locale"))&&payloadHash.equals(LocalV2PackageJson.hash(locale.get("contentChecksum")))&&"approved".equals(locale.get("reviewStatus"))&&LocalV2PackageJson.bool(locale.get("available"))&&LocalV2PackageJson.identifier(locale.get("reviewerId"))!=null);
            long reviewTime=epoch(locale.get("reviewedAt"));require(reviewTime<=now);
            java.util.Map<String,Object> rights=LocalV2PackageJson.object(m.get("rights"),"status","basis","platforms","territories","validFrom","expiresAt");require("approved".equals(rights.get("status"))&&java.util.Arrays.asList("original","public-domain").contains(rights.get("basis")));
            java.util.Set<String> audience=LocalV2PackageJson.strings(rights.get("platforms"),4,"web-pwa|android-google|android-rustore|ios-ipados"),countries=LocalV2PackageJson.strings(rights.get("territories"),676,"[A-Z]{2}");require(audience.contains(platform)&&countries.contains(territory));
            long start=epoch(rights.get("validFrom"));require(start<=now);if(rights.get("expiresAt")!=null){long end=epoch(rights.get("expiresAt"));require(start<end&&now<end);}
        }
        private static long iso(String value) throws Exception {require(value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z"));java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",java.util.Locale.ROOT);format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));format.setLenient(false);java.util.Date date=format.parse(value);require(format.format(date).equals(value)&&date.getTime()>=0);return date.getTime();}
        private static byte[] unhex(String value,int count) throws Exception {require(value!=null&&value.matches("[a-f0-9]{"+(count*2)+"}"));byte[] bytes=new byte[count];for(int i=0;i<count;i++)bytes[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);return bytes;}
        private static byte[] derSignature(byte[] raw) throws Exception {require(raw.length==64);java.io.ByteArrayOutputStream body=new java.io.ByteArrayOutputStream();for(int part=0;part<2;part++){int from=part*32,to=from+32;while(from<to&&raw[from]==0)from++;require(from<to);boolean pad=(raw[from]&128)!=0;body.write(2);body.write(to-from+(pad?1:0));if(pad)body.write(0);body.write(raw,from,to-from);}byte[] pair=body.toByteArray();byte[] out=new byte[pair.length+2];out[0]=48;out[1]=(byte)pair.length;System.arraycopy(pair,0,out,2,pair.length);LocalSnapshotV2.wipe(pair);return out;}
        private static void signature(java.util.Map<String,Object> review,java.util.List<Object> keys) throws Exception {signatureDomain(review,keys,"LP-CHILD-RELEASE-REVIEW\0v1\0");} private static void signatureDomain(java.util.Map<String,Object> review,java.util.List<Object> keys,String domain) throws Exception {java.util.Map<String,Object> selected=null;for(Object item:keys){java.util.Map<String,Object> key=LocalV2PackageJson.object(item,"keyId","reviewerId","publicKeyX963Hex");if(key.get("keyId").equals(review.get("keyId"))&&key.get("reviewerId").equals(review.get("reviewerId"))){require(selected==null);selected=key;}}
            require(selected!=null);byte[] point=unhex(LocalV2PackageJson.text(selected.get("publicKeyX963Hex")),65),prefix=unhex("3059301306072a8648ce3d020106082a8648ce3d030107034200",26),encoded=new byte[prefix.length+point.length],raw=null,der=null,message=null;
            try{require(point[0]==4);System.arraycopy(prefix,0,encoded,0,prefix.length);System.arraycopy(point,0,encoded,prefix.length,point.length);java.security.PublicKey key=java.security.KeyFactory.getInstance("EC").generatePublic(new java.security.spec.X509EncodedKeySpec(encoded));require(MessageDigest.isEqual(encoded,key.getEncoded()));
                raw=unhex(LocalV2PackageJson.text(review.get("signatureHex")),64);der=derSignature(raw);java.util.LinkedHashMap<String,Object> unsigned=new java.util.LinkedHashMap<>(review);unsigned.remove("signatureHex");message=(domain+LocalV2PackageJson.json(unsigned,true)).getBytes(StandardCharsets.UTF_8);
                java.security.Signature verifier=java.security.Signature.getInstance("SHA256withECDSA");verifier.initVerify(key);verifier.update(message);require(verifier.verify(der));
            }finally{LocalSnapshotV2.wipe(point);LocalSnapshotV2.wipe(prefix);LocalSnapshotV2.wipe(encoded);LocalSnapshotV2.wipe(raw);LocalSnapshotV2.wipe(der);LocalSnapshotV2.wipe(message);}}
        private static LocalV2CompiledPackage compile(byte[] bytes,byte[] reviewBytes,java.util.Map<String,Object> pin,java.util.List<Object> keys,LocalV2PackageProfile profile,String platform,String territory,long now,Fence fence) throws Exception {
            require(PLATFORMS.contains(platform)&&territory!=null&&territory.matches("[A-Z]{2}")&&now>=0&&now<=8640000000000000L&&fence!=null);fence.check();LocalV2PackageJson.object(pin,"packageId","packageVersion","packageChecksum","reviewChecksum");
            require(iso(LocalV2PackageJson.text(profile.profile.get("ageConfirmedAt")))<=now);
            String checksum=LocalV2PackageJson.hash(pin.get("packageChecksum")),reviewChecksum=LocalV2PackageJson.hash(pin.get("reviewChecksum"));require(checksum.equals(digest(bytes))&&reviewChecksum.equals(digest(reviewBytes)));
            java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,8388608),ROOT),review=LocalV2PackageJson.object(LocalV2PackageJson.read(reviewBytes,524288),REVIEW);
            String packageId=LocalV2PackageJson.identifier(root.get("packageId"));long version=LocalV2PackageJson.number(root.get("packageVersion"),1,MAX_SAFE);require(LocalV2PackageJson.number(root.get("schemaVersion"),1,1)==1&&"child".equals(root.get("namespace"))&&packageId.equals(pin.get("packageId"))&&version==LocalV2PackageJson.number(pin.get("packageVersion"),1,MAX_SAFE)
                &&profile.locale.equals(root.get("locale"))&&profile.exactAge==LocalV2PackageJson.number(root.get("exactAge"),3,17)&&profile.policyVersion.equals(root.get("policyVersion"))&&profile.policyChecksum.equals(root.get("policyChecksum")));window(root,"validFromEpochMs","validUntilEpochMs",now);
            require(LocalV2PackageJson.number(review.get("schemaVersion"),1,1)==1&&"literary-planet-child-release-review-v1".equals(review.get("kind"))&&packageId.equals(review.get("packageId"))&&version==LocalV2PackageJson.number(review.get("packageVersion"),1,MAX_SAFE)&&checksum.equals(review.get("packageChecksum"))
                &&profile.policyVersion.equals(review.get("policyVersion"))&&profile.policyChecksum.equals(review.get("policyChecksum"))&&profile.locale.equals(review.get("locale"))&&profile.exactAge==LocalV2PackageJson.number(review.get("exactAge"),3,17)&&epoch(review.get("reviewedAtEpochMs"))<=now);
            require(LocalV2PackageJson.text(review.get("keyId")).matches("child-release-review-[A-Za-z0-9_-]{1,48}")&&LocalV2PackageJson.identifier(review.get("reviewerId"))!=null);window(review,"validFromEpochMs","validUntilEpochMs",now);
            java.util.HashSet<Object> readings=new java.util.HashSet<>();for(Object reading:LocalV2PackageJson.array(review.get("readingLevels"),4)){require((reading==null||java.util.Arrays.asList("plain","developing","fluent").contains(reading))&&readings.add(reading));}require(readings.contains(profile.reading));
            require(LocalV2PackageJson.strings(review.get("platforms"),3,"android-google|android-rustore|ios-ipados").contains(platform)&&LocalV2PackageJson.strings(review.get("territories"),676,"[A-Z]{2}").contains(territory));signature(review,keys);fence.check();
            java.util.HashMap<String,java.util.Map<String,Object>> approved=new java.util.HashMap<>();for(Object row:LocalV2PackageJson.array(review.get("entityPolicyChecksums"),4096)){java.util.Map<String,Object> entry=LocalV2PackageJson.object(row,"kind","id","payloadChecksum","policyChecksum");String kind=LocalV2PackageJson.text(entry.get("kind"));require(KINDS.contains(kind));String key=kind+"/"+LocalV2PackageJson.identifier(entry.get("id"));LocalV2PackageJson.hash(entry.get("payloadChecksum"));LocalV2PackageJson.hash(entry.get("policyChecksum"));require(approved.put(key,entry)==null);}
            java.util.LinkedHashMap<String,byte[]> owned=new java.util.LinkedHashMap<>();java.util.HashMap<String,String> hashes=new java.util.HashMap<>();java.util.HashMap<String,java.util.List<Object>> references=new java.util.HashMap<>();boolean adopted=false;
            try{java.util.List<Object> entities=LocalV2PackageJson.array(root.get("entities"),4096);require(!entities.isEmpty()&&entities.size()==approved.size());long until=Math.min(epoch(root.get("validUntilEpochMs")),epoch(review.get("validUntilEpochMs")));
                for(Object entity:entities){fence.check();java.util.Map<String,Object> row=LocalV2PackageJson.object(entity,"policy","payload"),policy=LocalV2PackageJson.object(row.get("policy"));String key=LocalV2PackageJson.text(policy.get("kind"))+"/"+LocalV2PackageJson.identifier(policy.get("id"));require(!owned.containsKey(key));byte[] data=payload(row.get("payload"));boolean retained=false;
                    try{String payloadHash=digest(data);policy(policy,profile,platform,territory,now,payloadHash);java.util.Map<String,Object> entry=approved.get(key);require(entry!=null&&payloadHash.equals(entry.get("payloadChecksum")));byte[] policyBytes=LocalV2PackageJson.bytes(policy,true);try{require(digest(policyBytes).equals(entry.get("policyChecksum")));}finally{LocalSnapshotV2.wipe(policyBytes);}
                        java.util.Map<String,Object> rights=LocalV2PackageJson.object(policy.get("rights"));if(rights.get("expiresAt")!=null)until=Math.min(until,epoch(rights.get("expiresAt")));java.util.List<Object> refs=LocalV2PackageJson.array(LocalV2PackageJson.object(row.get("payload")).get("references"),64);String kind=LocalV2PackageJson.text(policy.get("kind"));
                        if(java.util.Arrays.asList("search-result","recommendation","favorite","recent","deep-link").contains(kind))require(refs.size()==1);if(kind.equals("offline-package"))require(!refs.isEmpty());owned.put(key,data);hashes.put(key,payloadHash);references.put(key,refs);retained=true;
                    }finally{if(!retained)LocalSnapshotV2.wipe(data);}}
                for(java.util.List<Object> refs:references.values())for(Object entry:refs){fence.check();String key=ref(entry);require(LocalV2PackageJson.object(entry).get("contentChecksum").equals(hashes.get(key)));}
                String home=ref(root.get("home"));require(home.startsWith("activity/")&&LocalV2PackageJson.object(root.get("home")).get("contentChecksum").equals(hashes.get(home)));fence.check();require(now<until);
                LocalV2CompiledPackage result=new LocalV2CompiledPackage(profile,packageId,version,checksum,reviewChecksum,platform,territory,home,until,owned);adopted=true;return result;
            }finally{if(!adopted)for(byte[] data:owned.values())LocalSnapshotV2.wipe(data);references.clear();hashes.clear();approved.clear();}
        }
    }
    /** Catalog trust is read only from the signed app's fixed bundled assets.
     * The separately pinned review is never supplied by a package or JS. */
    private static final class LocalV2PackageCatalog {
        final String platform;final java.util.List<Object> keys,pins;final java.util.Map<String,java.util.Map<String,Object>> inventory=new java.util.HashMap<>();
        private LocalV2PackageCatalog(byte[] catalogBytes,byte[] artifactBytes,String expectedPlatform) throws Exception {
            java.util.Map<String,Object> artifact=LocalV2PackageJson.object(LocalV2PackageJson.read(artifactBytes,2097152));require(Long.valueOf(1).equals(artifact.get("schemaVersion"))&&"literary-planet-bundled-native-preparation".equals(artifact.get("kind"))&&expectedPlatform.equals(artifact.get("platform")));
            String channel=LocalV2PackageJson.text(artifact.get("channel"));platform=expectedPlatform.equals("android")?(channel.equals("googlePlay")?"android-google":channel.equals("ruStore")?"android-rustore":null):(channel.equals("appStore")?"ios-ipados":null);
            boolean emptyDev=platform==null&&channel.equals("dev");require(platform!=null||emptyDev);java.util.Map<String,Object> catalog=LocalV2PackageJson.object(LocalV2PackageJson.read(catalogBytes,65536),"schemaVersion","kind","platform","pinSourceChecksum","reviewKeys","packages");
            require(Long.valueOf(1).equals(catalog.get("schemaVersion"))&&"literary-planet-child-native-assets-v1".equals(catalog.get("kind"))&&(platform==null?catalog.get("platform")==null:platform.equals(catalog.get("platform"))));
            String sourceHash=LocalV2PackageJson.hash(catalog.get("pinSourceChecksum"));int sources=0;java.util.Map<String,Object> inputs=LocalV2PackageJson.object(artifact.get("sourceInputs"));for(Object row:LocalV2PackageJson.array(inputs.get("files"),20000)){
                java.util.Map<String,Object> file=LocalV2PackageJson.object(row,"path","sha256");if("src/child/childNativeReleasePins.json".equals(file.get("path"))){require(sourceHash.equals(file.get("sha256")));sources++;}}require(sources==1);
            for(Object row:LocalV2PackageJson.array(artifact.get("inventory"),20000)){java.util.Map<String,Object> file=LocalV2PackageJson.object(row,"path","bytes","sha256");String name=LocalV2PackageJson.text(file.get("path"));LocalV2PackageJson.number(file.get("bytes"),1,MAX_SAFE);LocalV2PackageJson.hash(file.get("sha256"));require(inventory.put(name,file)==null);}
            verify("child-native/catalog-v1.json",catalogBytes,65536);keys=LocalV2PackageJson.array(catalog.get("reviewKeys"),16);pins=LocalV2PackageJson.array(catalog.get("packages"),32);require(!emptyDev||keys.isEmpty()&&pins.isEmpty());
            java.util.HashSet<String> keyIds=new java.util.HashSet<>(),points=new java.util.HashSet<>(),ids=new java.util.HashSet<>(),checksums=new java.util.HashSet<>();
            for(Object row:keys){java.util.Map<String,Object> key=LocalV2PackageJson.object(row,"keyId","reviewerId","publicKeyX963Hex");String id=LocalV2PackageJson.text(key.get("keyId")),point=LocalV2PackageJson.text(key.get("publicKeyX963Hex"));require(id.matches("child-release-review-[A-Za-z0-9_-]{1,48}")&&LocalV2PackageJson.identifier(key.get("reviewerId"))!=null&&point.matches("04[a-f0-9]{128}")&&keyIds.add(id)&&points.add(point));}
            for(Object row:pins){java.util.Map<String,Object> pin=LocalV2PackageJson.object(row,"packageId","packageVersion","packageChecksum","reviewChecksum");String id=LocalV2PackageJson.identifier(pin.get("packageId"));long version=LocalV2PackageJson.number(pin.get("packageVersion"),1,MAX_SAFE);String sum=LocalV2PackageJson.hash(pin.get("packageChecksum")),review=LocalV2PackageJson.hash(pin.get("reviewChecksum"));require(ids.add(id+"/"+version)&&checksums.add(sum));
                require(inventory.containsKey("child-native/packages/"+sum+".json")&&inventory.containsKey("child-native/reviews/"+review+".json"));}
        }
        private void verify(String fixedPath,byte[] bytes,int bound) throws Exception {java.util.Map<String,Object> row=inventory.get(fixedPath);require(row!=null&&bytes!=null&&bytes.length>0&&bytes.length<=bound&&bytes.length==LocalV2PackageJson.number(row.get("bytes"),1,bound)&&digest(bytes).equals(row.get("sha256")));}
    }
    /** Every outgoing copy joins the original final fence. Cancellation can
     * wipe returned arrays without waiting for a host/main-thread callback. */
    private static final class LocalV2PackageCopies {
        private final LocalV2CompiledPackage compiled;private boolean closed;private final java.util.ArrayList<byte[]> borrowed=new java.util.ArrayList<>();
        private LocalV2PackageCopies(LocalV2CompiledPackage compiled){this.compiled=compiled;}
        private byte[] copy(String key,java.util.concurrent.Callable<Long> clock,LocalV2PackageCompiler.Fence fence) throws Exception {
            synchronized(this){require(!closed&&borrowed.size()<64);}fence.check();byte[] bytes=compiled.copy(key,clock.call());boolean published=false;
            try{fence.check();long now=clock.call();require(now>=0&&now<compiled.until);
                synchronized(this){require(!closed&&borrowed.size()<64);borrowed.add(bytes);published=true;return bytes;}
            }finally{if(!published)LocalSnapshotV2.wipe(bytes);}
        }
        private synchronized void close(){closed=true;for(byte[] copy:borrowed)LocalSnapshotV2.wipe(copy);borrowed.clear();compiled.close();}
    }
    private interface LocalV2PackageRecipient {void receive(LocalV2OwnedPackageDelivery original) throws Exception;}
    /** A one-use original delivery of data, not an admitted AES capability.
     * Reads stay inside the original worker/host/canonical lease and expire
     * with that operation; retaining this object cannot renew its lifetime. */
    private static final class LocalV2OwnedPackageDelivery {
        final LocalV2NativePackageLoader owner;final LocalV2CompiledPackage compiled;private final LocalV2PackageCopies copies;private LocalV2DataAdmission data;
        private volatile LocalV2AppOwner mediaOwner;private java.util.LinkedHashMap<String,LocalV2MediaAsset> mediaAssets;private LocalV2ResourceCatalog resourceCatalog;private volatile LocalV2SDKChannel.Command sdkCommand; private LocalV2OwnedPackageDelivery(LocalV2NativePackageLoader owner,LocalV2CompiledPackage compiled){this.owner=owner;this.compiled=compiled;copies=new LocalV2PackageCopies(compiled);}
        private void fence() throws Exception {try{require(owner.delivery==this&&owner.worker==Thread.currentThread());owner.fresh(compiled.profile);owner.live();}catch(Exception failure){owner.revoke();throw failure;}}
        private byte[] copyHome() throws Exception {try{return copies.copy(compiled.home,owner::wall,this::fence);}catch(Exception failure){owner.revoke();throw failure;}}
        private byte[] copyEntity(String kind,String id) throws Exception {require(LocalV2PackageCompiler.KINDS.contains(kind)&&id!=null&&id.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));try{return copies.copy(kind+"/"+id,owner::wall,this::fence);}catch(Exception failure){owner.revoke();throw failure;}}
        private LocalV2AdmittedResult batch(java.util.List<PlanetChildDataStore.ReadKey> reads,java.util.List<PlanetChildDataStore.Mutation> writes) throws Exception {fence();require(data!=null);return data.batch(reads,writes);}
        private void close(){if(mediaOwner!=null)try{mediaOwner.fastMediaConceal();}catch(Exception failure){owner.writer.unknown(owner.request);}if(data!=null)data.revoke();copies.close();}
    }
    /** Concrete fixed AssetManager producer on the original native route.
     * Vault -> bundled bytes is the only lock order; no main join/file-lock
     * recursion, transport, caller filenames, account or QA trust fallback. */
    /** Private native continuation of the original ACKed LOCAL2 read lane.
     * Only sdkPackageHandoff under its original Vault transaction can mint it.
     * It transfers the actual request graph; it cannot renew or reanchor time. */
    private static final class LocalV2SDKPackageHandoff {
        final LocalV2Writer writer;final LocalV2Request request;final String checksum;private byte[] captured;private LocalV2NativePackageLoader owner;
        private LocalV2SDKPackageHandoff(LocalV2Writer writer,LocalV2Request request,byte[] captured,String checksum){
            this.writer=writer;this.request=request;this.captured=captured.clone();this.checksum=checksum;
        }
        private void claim(LocalV2NativePackageLoader loader,android.app.Activity activity,LocalSnapshotV2Policy policy,long deadline) throws Exception {
            synchronized(writer){writer.live(request);require(owner==null&&writer.active==request&&request.owner==writer&&request.activity==activity&&request.deadline==deadline
                &&request.policy.version.equals(policy.version)&&request.policy.checksum.equals(policy.checksum)&&request.anchored&&request.workers==0
                &&request.receipt==null&&!request.unacknowledgedMutation&&request.sdkPackageLoader==null&&MessageDigest.isEqual(captured,request.currentBytes));
                owner=loader;request.sdkPackageLoader=loader;}
        }
        private void check(LocalV2NativePackageLoader loader) throws Exception {
            synchronized(writer){writer.live(request);require(owner==loader&&request.sdkPackageLoader==loader&&writer.active==request&&request.anchored
                &&request.receipt==null&&!request.unacknowledgedMutation&&captured!=null&&MessageDigest.isEqual(captured,request.currentBytes)&&digest(captured).equals(checksum));}
        }
        private void close(){LocalSnapshotV2.wipe(captured);captured=null;}
    }
    private static final class LocalV2NativePackageLoader implements AutoCloseable {
        final LocalV2Writer writer;final LocalV2Request request;final android.app.Activity activity;final android.view.ViewGroup route;final android.os.IBinder window;
        private final android.view.ViewParent[] ancestry;private final LocalV2PackageRecipient recipient;private final String territory;private final LocalV2SDKPackageHandoff sdkHandoff;
        private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());private volatile boolean revoked,closed;
        private volatile Thread worker,retirement;private volatile LocalV2OwnedPackageDelivery delivery;private java.util.function.Consumer<Throwable> sdkFailure;private volatile Throwable failure;private android.view.View.OnAttachStateChangeListener attachment;
        private androidx.activity.OnBackPressedCallback back;private android.view.ViewTreeObserver.OnGlobalLayoutListener layout;private android.view.ViewTreeObserver.OnWindowFocusChangeListener focus;
        private long wallLast=-1;private boolean sent;private final Runnable watch=()->watchOriginal();
        private LocalV2NativePackageLoader(PlanetChildVault vault,android.app.Activity activity,android.view.ViewGroup route,LocalSnapshotV2Policy policy,long timeoutMs,LocalV2PackageRecipient recipient) throws Exception {this(vault,activity,route,policy,timeoutMs,0,recipient,null);}
        private LocalV2NativePackageLoader(PlanetChildVault vault,android.app.Activity activity,android.view.ViewGroup route,LocalSnapshotV2Policy policy,long timeoutMs,long deadline,LocalV2PackageRecipient recipient,java.util.function.Consumer<Throwable> sdkFailure) throws Exception {this(vault,activity,route,policy,timeoutMs,deadline,recipient,sdkFailure,null);}
        private LocalV2NativePackageLoader(PlanetChildVault vault,android.app.Activity activity,android.view.ViewGroup route,LocalSnapshotV2Policy policy,long timeoutMs,long deadline,LocalV2PackageRecipient recipient,java.util.function.Consumer<Throwable> sdkFailure,LocalV2SDKPackageHandoff handoff) throws Exception {
            this.sdkFailure=sdkFailure;this.sdkHandoff=handoff;
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&activity!=null&&activity.getClass()==MainActivity.class&&route!=null&&!(route instanceof android.webkit.WebView)&&route!=activity.getWindow().getDecorView()&&recipient!=null);
            this.activity=activity;this.route=route;this.recipient=recipient;window=activity.getWindow().getDecorView().getWindowToken();territory=java.util.Locale.getDefault().getCountry();require(window!=null&&territory.matches("[A-Z]{2}"));
            java.util.ArrayList<android.view.ViewParent> parents=new java.util.ArrayList<>();android.view.ViewParent parent=route.getParent();while(parent!=null){require(!(parent instanceof android.webkit.WebView));parents.add(parent);parent=parent.getParent();}require(!parents.isEmpty());ancestry=parents.toArray(new android.view.ViewParent[0]);
            writer=handoff==null?new LocalV2Writer(vault):handoff.writer;request=handoff==null?writer.requestAt(activity,policy,timeoutMs,deadline):handoff.request;try{if(handoff!=null){require(writer.vault==vault);handoff.claim(this,activity,policy,deadline);}current();attach();}catch(Throwable failure){revoke();startRetirement();throw failure;}
        }
        private void current() throws Exception {require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&!closed&&!revoked&&!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus()
            &&activity.getWindow().getDecorView().getWindowToken()==window&&route.getWindowToken()==window&&route.getRootView()==activity.getWindow().getDecorView()&&route.isShown()&&territory.equals(java.util.Locale.getDefault().getCountry()));
            android.view.ViewParent parent=route.getParent();for(android.view.ViewParent original:ancestry){require(parent==original);parent=parent.getParent();}require(parent==null);writer.live(request);}
        private void watchOriginal(){if(closed||revoked)return;try{current();LocalV2OwnedPackageDelivery original=delivery;if(original!=null)require(wall()<original.compiled.until);require(main.postDelayed(watch,10));}catch(Exception failure){revoke();}}
        private void attach(){requireWatch();attachment=new android.view.View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(android.view.View view){}public void onViewDetachedFromWindow(android.view.View view){revoke();}};route.addOnAttachStateChangeListener(attachment);
            back=new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){revoke();setEnabled(false);((MainActivity)activity).getOnBackPressedDispatcher().onBackPressed();}};((MainActivity)activity).getOnBackPressedDispatcher().addCallback((MainActivity)activity,back);
            layout=()->{try{current();}catch(Exception failure){revoke();}};focus=focused->{if(!focused)revoke();};route.getViewTreeObserver().addOnGlobalLayoutListener(layout);route.getViewTreeObserver().addOnWindowFocusChangeListener(focus);}
        private void requireWatch(){if(!main.post(watch))throw new IllegalStateException("Original loader watch unavailable");}
        private void live() throws Exception {require(!revoked&&!closed&&worker==Thread.currentThread());writer.live(request);}
        private synchronized long wall() throws Exception {long now=System.currentTimeMillis();if(now<0||now>8640000000000000L||now<wallLast){revoke();throw new PinKnownRefusal();}wallLast=now;return now;}
        private void mainCurrent() throws Exception {java.util.concurrent.FutureTask<Void> task=new java.util.concurrent.FutureTask<>(()->{current();return null;});require(main.post(task));boolean interrupted=false;try{for(;;)try{task.get();break;}catch(InterruptedException ignored){interrupted=true;}}finally{if(interrupted)Thread.currentThread().interrupt();}}
        private byte[] fixedAsset(String fixed,int bound) throws Exception {live();require(fixed.equals("artifact.json")||fixed.equals("child-native/catalog-v1.json")||fixed.matches("child-native/(packages|reviews)/[a-f0-9]{64}\\.json"));
            byte[] owned=new byte[bound];int used=0;try(java.io.InputStream input=writer.vault.context.getAssets().open("public/"+fixed,android.content.res.AssetManager.ACCESS_STREAMING)){
                for(;;){live();if(used==bound){require(input.read()==-1);break;}int count=input.read(owned,used,Math.min(8192,bound-used));if(count==-1)break;require(count>0);used+=count;}live();require(used>0);return java.util.Arrays.copyOf(owned,used);}finally{LocalSnapshotV2.wipe(owned);}}
        private LocalV2PackageProfile fresh(LocalV2PackageProfile original) throws Exception {live();mainCurrent();writer.begin(request);try{writer.host(request);return writer.vault.locked(directory->{live();writer.completeRecord(directory);byte[] current=writer.vault.readExact(directory);try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(current,request.policy)){
                    request.processClock.sample(request.processLease,current);require(request.currentBytes!=null&&MessageDigest.isEqual(request.currentBytes,current));if(original!=null)original.same(saved);return new LocalV2PackageProfile(saved);}finally{LocalSnapshotV2.wipe(current);}});}catch(Throwable failure){throw writer.failed(request,failure);}finally{writer.finish(request);}}
        private void start(){requireMain();try{current();require(worker==null&&!sent);worker=new Thread(this::run,"planet-child-native-package");worker.start();}catch(Throwable failure){revoke();startRetirement();}}
        private void requireMain(){if(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper())throw new IllegalStateException("Original native main required");}
        private <T> T withData(LocalV2DataAdmission admission,LocalV2DataWork<T> work) throws Exception {live();mainCurrent();writer.begin(request);try{writer.host(request);return writer.vault.locked(directory->{live();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{request.processClock.sample(request.processLease,actual);require(request.currentBytes!=null&&MessageDigest.isEqual(request.currentBytes,actual));try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(actual,request.policy)){admission.compiled.profile.same(saved);}admission.enter(directory,actual);try{T result=work.run();try{admission.check();return result;}catch(Exception failure){if(result instanceof PlanetChildDataStore.Result)((PlanetChildDataStore.Result)result).close();else if(result instanceof byte[])LocalSnapshotV2.wipe((byte[])result);throw failure;}}finally{admission.leave();}}finally{LocalSnapshotV2.wipe(actual);}});}catch(Throwable failure){throw writer.failed(request,failure);}finally{writer.finish(request);}}
        private void run(){LocalV2CompiledPackage result=null;try{live();mainCurrent();if(sdkHandoff==null){LocalV2StorageReceipt anchor=writer.reanchor(request);if(anchor!=null)writer.acknowledge(anchor);}else sdkHandoff.check(this);LocalV2PackageProfile profile=fresh(null);if(sdkHandoff!=null)require(profile.recordChecksum.equals(sdkHandoff.checksum));result=new LocalV2FixedPackageProducer(this,profile).compile();fresh(profile);mainCurrent();live();synchronized(this){require(!revoked&&!closed&&!sent&&delivery==null);sent=true;delivery=new LocalV2OwnedPackageDelivery(this,result);result=null;delivery.data=new LocalV2DataAdmission(this,delivery.compiled);}delivery.data.admit();recipient.receive(delivery);live();fresh(profile);require(wall()<delivery.compiled.until);}catch(Throwable failure){this.failure=failure;if(sdkFailure!=null)sdkFailure.accept(failure);revoke();}finally{if(delivery!=null)delivery.close();if(result!=null)result.close();if(sdkHandoff!=null)sdkHandoff.close();startRetirement();}}
        /** Native route owner calls before same-view reuse; Back/detachment
         * and all real background events independently latch revocation. */
        private void routeWillChange(){revoke();}
        private void revoke(){LocalV2OwnedPackageDelivery original;synchronized(this){revoked=true;original=delivery;}if(original!=null)original.close();try{writer.cancel(request);}catch(Exception failure){writer.unknown(request);}startRetirement();}
        private synchronized void startRetirement(){if(retirement!=null)return;Thread original=worker;retirement=new Thread(()->{boolean interrupted=false;try{if(original!=null)for(;;)try{original.join();break;}catch(InterruptedException ignored){interrupted=true;}
                    Throwable drainFailure=null;try{if(delivery!=null&&delivery.data!=null)delivery.data.drain();}catch(Throwable failure){drainFailure=failure;}
                    java.util.concurrent.FutureTask<Void> cleanup=new java.util.concurrent.FutureTask<>(()->{detach();return null;});require(main.post(cleanup));for(;;)try{cleanup.get();break;}catch(InterruptedException ignored){interrupted=true;}
                    if(drainFailure!=null)throw drainFailure;if(delivery!=null&&delivery.mediaOwner!=null)delivery.mediaOwner.retireMediaBeforePackageRelease(delivery);if(delivery!=null&&delivery.mediaAssets!=null){delivery.mediaAssets.clear();delivery.mediaAssets=null;}if(sdkHandoff!=null)sdkHandoff.close();writer.retire(request);closed=true;
                }catch(Throwable failure){writer.unknown(request);}finally{if(interrupted)Thread.currentThread().interrupt();}},"planet-child-native-package-retire");retirement.start();}
        private void detach() throws Exception {Throwable failure=null;main.removeCallbacks(watch);
            try{if(back!=null)back.remove();}catch(Throwable error){failure=error;}
            try{if(attachment!=null)route.removeOnAttachStateChangeListener(attachment);}catch(Throwable error){if(failure==null)failure=error;else failure.addSuppressed(error);}
            try{if(layout!=null&&route.getViewTreeObserver().isAlive())route.getViewTreeObserver().removeOnGlobalLayoutListener(layout);}catch(Throwable error){if(failure==null)failure=error;else failure.addSuppressed(error);}
            try{if(focus!=null&&route.getViewTreeObserver().isAlive())route.getViewTreeObserver().removeOnWindowFocusChangeListener(focus);}catch(Throwable error){if(failure==null)failure=error;else failure.addSuppressed(error);}
            if(failure instanceof Error)throw(Error)failure;if(failure!=null)throw failure instanceof Exception?(Exception)failure:new Unavailable();}
        public void close(){requireMain();revoke();startRetirement();}
        private void sdkJoin() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());Thread original=retirement;if(original!=null)original.join();require(closed&&request.retired&&!request.sealed&&!request.processClock.invalid&&writer.active==null);}
    }

    /** Actual compiled payloads, not claimed checksums, authorize envelopes.
     * Favorites are existing cache wrapper entities; the native protocol keeps
     * its original four purposes. This leaf cannot construct admission. */
    private static final class LocalV2AdmittedEnvelope {
        private static java.util.Map<String,Object> scope(LocalV2CompiledPackage c) throws Exception {
            java.util.LinkedHashMap<String,Object> m=new java.util.LinkedHashMap<>();m.put("schemaVersion",1L);m.put("namespace","child");m.put("profileId",c.profile.id);m.put("profileRevision",c.profile.revision);m.put("exactAge",c.profile.exactAge);m.put("locale",c.profile.locale);m.put("policyVersion",c.profile.policyVersion);m.put("policyChecksum",c.profile.policyChecksum);m.put("packageId",c.packageId);m.put("packageVersion",c.version);m.put("packageChecksum",c.checksum);return m;
        }
        private static String binding(LocalV2PackageProfile p) throws Exception {java.util.LinkedHashMap<String,Object> m=new java.util.LinkedHashMap<>();m.put("profile",p.profile);m.put("profileRevision",p.revision);m.put("selectionRevision",p.selectionRevision);m.put("policyVersion",p.policyVersion);m.put("policyChecksum",p.policyChecksum);byte[] bytes=LocalV2PackageJson.bytes(m,true);try{return digest(bytes);}finally{LocalSnapshotV2.wipe(bytes);}}
        private static String contentBinding(LocalV2PackageProfile p) throws Exception {java.util.LinkedHashMap<String,Object> m=new java.util.LinkedHashMap<>();m.put("profile",p.profile);m.put("policyVersion",p.policyVersion);m.put("policyChecksum",p.policyChecksum);byte[] bytes=LocalV2PackageJson.bytes(m,true);try{return digest(bytes);}finally{LocalSnapshotV2.wipe(bytes);}}
        private static java.util.Map<String,Object> reference(LocalV2CompiledPackage c,String key,long now) throws Exception {byte[] payload=c.copy(key,now);try{int slash=key.indexOf('/');require(slash>0);java.util.LinkedHashMap<String,Object> m=new java.util.LinkedHashMap<>();m.put("kind",key.substring(0,slash));m.put("id",key.substring(slash+1));m.put("contentChecksum",digest(payload));return m;}finally{LocalSnapshotV2.wipe(payload);}}
        private static String checkedRef(LocalV2CompiledPackage c,Object value,long now) throws Exception {String key=LocalV2PackageCompiler.ref(value);require(reference(c,key,now).equals(LocalV2PackageJson.object(value,"kind","id","contentChecksum")));return key;}
        private static String migrationRef(LocalV2CompiledPackage c,Object value,long now) throws Exception {java.util.Map<String,Object> row=LocalV2PackageJson.object(value,"kind","id","contentChecksum");String key=LocalV2PackageCompiler.ref(row),hash=LocalV2PackageJson.hash(row.get("contentChecksum"));return c.migrationReference(key,hash,now);}
        private static java.util.Map<String,Object> payload(LocalV2CompiledPackage c,String key,long now) throws Exception {byte[] bytes=c.copy(key,now);try{return LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,131072));}finally{LocalSnapshotV2.wipe(bytes);}}
        private static java.util.List<Object> search(LocalV2CompiledPackage c,long now) throws Exception {java.util.ArrayList<Object> refs=new java.util.ArrayList<>();synchronized(c){require(!c.closed&&now<c.until);for(String key:c.payloads.keySet())if(key.startsWith("search-result/"))refs.add(reference(c,key,now));}return refs;}
        private static java.util.List<Object> closure(LocalV2CompiledPackage c,String root,long now) throws Exception {java.util.ArrayList<String> queue=new java.util.ArrayList<>();java.util.HashSet<String> seen=new java.util.HashSet<>();java.util.ArrayList<Object> entries=new java.util.ArrayList<>();queue.add(root);
            for(int i=0;i<queue.size();i++){String key=queue.get(i);if(!seen.add(key))continue;require(entries.size()<4096);java.util.Map<String,Object> data=payload(c,key,now);java.util.LinkedHashMap<String,Object> entry=new java.util.LinkedHashMap<>();entry.put("reference",reference(c,key,now));entry.put("payload",data);entries.add(entry);for(Object link:LocalV2PackageJson.array(data.get("references"),64))queue.add(checkedRef(c,link,now));}return entries;}
        private static void validate(LocalV2CompiledPackage c,PlanetChildDataStore.Purpose purpose,String key,byte[] value,long now) throws Exception {require(value!=null&&value.length<=PlanetChildDataStore.MAX_VALUE_BYTES&&now>=0&&now<c.until);java.util.Map<String,Object> m=LocalV2PackageJson.object(LocalV2PackageJson.read(value,PlanetChildDataStore.MAX_VALUE_BYTES),"schemaVersion","scope",purpose==PlanetChildDataStore.Purpose.search||purpose==PlanetChildDataStore.Purpose.history?"references":"entries");require(Long.valueOf(1).equals(m.get("schemaVersion"))&&scope(c).equals(m.get("scope")));
            if(purpose==PlanetChildDataStore.Purpose.search){require(key.equals(key(c,purpose,null))&&search(c,now).equals(m.get("references")));return;}
            if(purpose==PlanetChildDataStore.Purpose.history){require(key.equals(key(c,purpose,null)));java.util.HashSet<String> seen=new java.util.HashSet<>();for(Object ref:LocalV2PackageJson.array(m.get("references"),100)){String id=checkedRef(c,ref,now);require(id.startsWith("recent/")&&seen.add(id));}return;}
            java.util.List<Object> entries=LocalV2PackageJson.array(m.get("entries"),4096);require(!entries.isEmpty());String root=checkedRef(c,LocalV2PackageJson.object(entries.get(0),"reference","payload").get("reference"),now);require(purpose!=PlanetChildDataStore.Purpose.offline||root.startsWith("offline-package/"));require(key.equals(key(c,purpose,root))&&closure(c,root,now).equals(entries));
        }
        private static PlanetChildDataStore.Scope dataScope(LocalV2CompiledPackage c) throws Exception {return new PlanetChildDataStore.Scope(c.profile.id,c.profile.revision,(int)c.profile.exactAge,c.profile.locale,c.profile.policyVersion,c.profile.policyChecksum,c.packageId,c.version,c.checksum);}
        private static String key(LocalV2CompiledPackage c,PlanetChildDataStore.Purpose purpose,String root) throws Exception {byte[] tuple=LocalV2PackageJson.bytes(java.util.Arrays.asList(1L,"child",c.profile.id,c.profile.revision,c.profile.exactAge,c.profile.locale,c.profile.policyVersion,c.profile.policyChecksum,c.packageId,c.version,c.checksum),false);try{StringBuilder out=new StringBuilder("probpera-child-v1/"+purpose.name()+"/");for(byte b:tuple)out.append("0123456789abcdef".charAt((b&255)>>>4)).append("0123456789abcdef".charAt(b&15));if(root!=null)out.append("/item/").append(root);return out.toString();}finally{LocalSnapshotV2.wipe(tuple);}}
        /** Returns null only for incompatible saved content; malformed old
         * bytes are already rejected by the durable snapshot decoder. */
        private static byte[] migrate(LocalV2CompiledPackage c,PlanetChildDataStore.Purpose purpose,byte[] old,long now) throws Exception {synchronized(c){require(!c.closed&&now>=0&&now<c.until);}java.util.Map<String,Object> previous=LocalV2PackageJson.object(LocalV2PackageJson.read(old,PlanetChildDataStore.MAX_VALUE_BYTES));if(!c.profile.id.equals(LocalV2PackageJson.object(previous.get("scope")).get("profileId")))return null;java.util.LinkedHashMap<String,Object> next=new java.util.LinkedHashMap<>();next.put("schemaVersion",1L);next.put("scope",scope(c));
            if(purpose==PlanetChildDataStore.Purpose.search)next.put("references",search(c,now));
            else if(purpose==PlanetChildDataStore.Purpose.history){java.util.ArrayList<Object> retained=new java.util.ArrayList<>();for(Object ref:LocalV2PackageJson.array(previous.get("references"),4096)){String id=migrationRef(c,ref,now);if(id!=null&&id.startsWith("recent/")&&retained.size()<100&&!retained.contains(ref))retained.add(ref);}next.put("references",retained);}
            else{java.util.List<Object> entries=LocalV2PackageJson.array(previous.get("entries"),4096);require(!entries.isEmpty());String id=migrationRef(c,LocalV2PackageJson.object(entries.get(0)).get("reference"),now);if(id==null)return null;next.put("entries",closure(c,id,now));}
            return LocalV2PackageJson.bytes(next,false);
        }
        private static LocalV2MigrationValue partition(LocalV2CompiledPackage c,PlanetChildDataStore.Purpose purpose,String oldKey,byte[] old,long now) throws Exception {java.util.Map<String,Object> m=LocalV2PackageJson.object(LocalV2PackageJson.read(old,PlanetChildDataStore.MAX_VALUE_BYTES));if(!c.profile.id.equals(LocalV2PackageJson.object(m.get("scope")).get("profileId")))return new LocalV2MigrationValue(oldKey,old.clone(),false);byte[] next=migrate(c,purpose,old,now);if(next==null)return null;String root=null;if(purpose==PlanetChildDataStore.Purpose.cache||purpose==PlanetChildDataStore.Purpose.offline){java.util.Map<String,Object> value=LocalV2PackageJson.object(LocalV2PackageJson.read(next,PlanetChildDataStore.MAX_VALUE_BYTES));root=checkedRef(c,LocalV2PackageJson.object(LocalV2PackageJson.array(value.get("entries"),4096).get(0)).get("reference"),now);}return new LocalV2MigrationValue(key(c,purpose,root),next,true);}
    }
    static final class LocalV2MigrationValue implements AutoCloseable {final String key;final byte[] bytes;final boolean changed;private LocalV2MigrationValue(String key,byte[] bytes,boolean changed){this.key=key;this.bytes=bytes;this.changed=changed;}public void close(){LocalSnapshotV2.wipe(bytes);}}
    /** Constructors are owned by the original loader/Gate only. DataStore
     * receives no caller scope or reviewer callback. check() runs under the
     * already-held Vault flock, then DataStore flock; it never joins main or
     * recursively acquires Vault. Every byte boundary rereads exact canonical. */
    static final class LocalV2DataAdmission {
        private final LocalV2NativePackageLoader loader;private final LocalV2GateMutation mutation;private final LocalV2CompiledPackage compiled;private final LocalV2DataContext previous,future;
        private final java.util.ArrayList<LocalV2AdmittedResult> results=new java.util.ArrayList<>();private volatile boolean revoked;private File directory;private byte[] expected;private Thread held;
        private PlanetChildDataStore store;private PlanetChildDataStore.Lease lease;
        private LocalV2DataAdmission(LocalV2NativePackageLoader loader,LocalV2CompiledPackage compiled) throws Exception {require(loader!=null&&compiled!=null&&loader.delivery!=null&&loader.delivery.compiled==compiled&&loader.worker==Thread.currentThread());loader.live();this.loader=loader;mutation=null;this.compiled=compiled;try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(loader.request.currentBytes,loader.request.policy)){previous=new LocalV2DataContext(saved);}future=previous;}
        private LocalV2DataAdmission(LocalV2GateMutation mutation,LocalV2CompiledPackage compiled,LocalV2DataContext previous) throws Exception {require(mutation!=null&&previous!=null&&mutation.futureContext!=null&&mutation.compatible==compiled&&mutation.previousContext==previous);mutation.boundary();loader=null;this.mutation=mutation;this.compiled=compiled;this.previous=previous;future=mutation.futureContext;require((compiled==null)=="adult".equals(future.mode));}
        PlanetChildDataStore.Scope scope() throws Exception {check();return compiled==null?null:LocalV2AdmittedEnvelope.dataScope(compiled);}
        String binding() throws Exception {check();return future.binding;}
        String previousBinding() throws Exception {check();return previous.binding;}
        String contentBinding() throws Exception {check();require(compiled!=null);return future.profiles.get(future.active);}
        String previousContentBinding() throws Exception {check();require(compiled!=null&&previous.profiles.containsKey(future.active));return previous.profiles.get(future.active);}
        boolean createsProfile() throws Exception {check();return mutation!=null&&mutation.original.generatedProfileId!=null;}
        void previousSeals(java.util.Map<String,String> seals) throws Exception {check();previous.seals(seals);}
        void futureSeals(java.util.Map<String,String> seals) throws Exception {check();future.seals(seals);}
        void retainedBirth(LocalV2KnownBirth birth) throws Exception {check();LocalSnapshotV2Policy policy=loader!=null?loader.request.policy:mutation.host.policy;require(birth!=null&&future.profiles.containsKey(birth.profileId)
            &&policy.version.equals(birth.policyVersion)&&policy.checksum.equals(birth.policyChecksum));if(initialProfile())require(future.profiles.get(birth.profileId).equals(birth.contentBinding));}
        boolean initialProfile() throws Exception {check();return loader!=null&&"child".equals(future.mode)&&future.selection==2&&future.revision==2&&future.profiles.size()==1;}
        String migrationIdentity() throws Exception {check();require(mutation!=null);byte[] bytes=("LP-LOCAL-V2-DATA-MIGRATION\0"+mutation.original.id+"\0"+mutation.original.action+"\0"+mutation.original.targetChecksum+"\0"+mutation.original.generation+"\0"+mutation.original.deadline+"\0"+previous.binding+"\0"+future.binding).getBytes(StandardCharsets.UTF_8);try{return digest(bytes);}finally{LocalSnapshotV2.wipe(bytes);}}
        long deadline() {return loader!=null?loader.request.deadline:mutation.original.deadline;}
        private long wall() throws Exception {return loader!=null?loader.wall():mutation.packageWall();}
        private PlanetChildVault vault(){return loader!=null?loader.writer.vault:mutation.host.writer.vault;}
        void check() throws Exception {require(!revoked&&held==Thread.currentThread()&&directory!=null&&expected!=null);if(loader!=null){loader.live();loader.writer.completeRecord(directory);}else{mutation.boundary();mutation.host.writer.completeRecord(directory);}if(compiled!=null)require(wall()<compiled.until);byte[] actual=vault().readExact(directory);try{require(MessageDigest.isEqual(expected,actual));}finally{LocalSnapshotV2.wipe(actual);}if(compiled!=null)synchronized(compiled){require(!compiled.closed);}}
        private void enter(File directory,byte[] actual) throws Exception {require(this.directory==null&&held==null&&!revoked);this.directory=directory;held=Thread.currentThread();expected=actual.clone();try{check();}catch(Exception failure){leave();throw failure;}}
        private void leave(){LocalSnapshotV2.wipe(expected);expected=null;held=null;directory=null;}
        void validate(PlanetChildDataStore.Purpose purpose,String key,byte[] value) throws Exception {check();LocalV2AdmittedEnvelope.validate(compiled,purpose,key,value,wall());check();}
        byte[] migrate(PlanetChildDataStore.Purpose purpose,byte[] value) throws Exception {check();byte[] next=LocalV2AdmittedEnvelope.migrate(compiled,purpose,value,wall());try{check();return next;}catch(Exception error){LocalSnapshotV2.wipe(next);throw error;}}
        LocalV2MigrationValue partition(PlanetChildDataStore.Purpose purpose,String key,byte[] value) throws Exception {check();LocalV2MigrationValue next=LocalV2AdmittedEnvelope.partition(compiled,purpose,key,value,wall());try{check();return next;}catch(Exception failure){if(next!=null)next.close();throw failure;}}
        String migratedKey(PlanetChildDataStore.Purpose purpose,byte[] value) throws Exception {check();PlanetChildDataStore.Scope s=scope();if(purpose==PlanetChildDataStore.Purpose.search||purpose==PlanetChildDataStore.Purpose.history)return s.key(purpose);java.util.Map<String,Object> m=LocalV2PackageJson.object(LocalV2PackageJson.read(value,PlanetChildDataStore.MAX_VALUE_BYTES));String key=checkedRoot(m);int slash=key.indexOf('/');return s.itemKey(purpose,key.substring(0,slash),key.substring(slash+1));}
        private String checkedRoot(java.util.Map<String,Object> value) throws Exception {java.util.List<Object> rows=LocalV2PackageJson.array(value.get("entries"),4096);require(!rows.isEmpty());return LocalV2AdmittedEnvelope.checkedRef(compiled,LocalV2PackageJson.object(rows.get(0)).get("reference"),wall());}
        void markDataWrite() throws Exception {check();if(mutation!=null)mutation.dataWrote=true;}
        void acknowledgeCanonical() throws Exception {check();require(mutation!=null);mutation.acknowledgeCanonical(directory);check();}
        void completionBoundary() throws Exception {check();require(mutation!=null);mutation.completionBoundary();}
        void commitCanonical() throws Exception {check();require(mutation!=null);mutation.commitCanonical(directory,expected);LocalSnapshotV2.wipe(expected);expected=mutation.next.clone();check();}
        private void admit() throws Exception {require(loader!=null&&store==null);loader.withData(this,()->{store=new PlanetChildDataStore(vault().context);lease=store.admit(this);return null;});}
        private LocalV2AdmittedResult batch(java.util.List<PlanetChildDataStore.ReadKey> reads,java.util.List<PlanetChildDataStore.Mutation> writes) throws Exception {require(loader!=null&&store!=null&&lease!=null);PlanetChildDataStore.Result result=null;LocalV2AdmittedResult owned=null;boolean handed=false;try{result=loader.withData(this,()->{PlanetChildDataStore.Cancellation cancel=store.admittedOperation(this,lease);return store.admittedTransact(this,lease,reads,writes,cancel);});owned=new LocalV2AdmittedResult(this,result);result=null;publication();final LocalV2AdmittedResult original=owned;publish(()->{require(results.size()<64);results.add(original);return null;});handed=true;return owned;}catch(Exception failure){failed();throw failure;}finally{if(!handed&&owned!=null)owned.close();if(result!=null)result.close();if(writes!=null)for(PlanetChildDataStore.Mutation write:writes)if(write!=null)write.close();}}
        private void publication() throws Exception {require(loader!=null);LocalV2AdmittedPublication.check(compiled,this::wall,()->loader.fresh(compiled.profile));}
        private synchronized <T>T publish(LocalV2DataWork<T> work) throws Exception {require(!revoked&&loader!=null);LocalV2AdmittedPublication.check(compiled,this::wall,loader::live);return work.run();}
        private void failed(){revoke();if(loader!=null)loader.revoke();}
        private synchronized void revoke(){revoked=true;for(LocalV2AdmittedResult result:results)result.close();results.clear();}
        private void drain() throws Exception {revoke();if(store!=null){vault().locked(d->{store.close();return null;});store=null;lease=null;}}

        private LocalV2SDKChannel.Command sdkCollectionCommand;
        void collectionCommandKnown(String commandId) throws Exception {check();LocalV2SDKChannel.Command command=loader.delivery.sdkCommand;require(command!=null&&command==sdkCollectionCommand&&command.id.equals(commandId)&&command.running&&!command.returned&&!command.collectionKnown&&loader.worker==Thread.currentThread());command.collectionKnown=true;}
        void collectionCommandReady(String commandId) throws Exception {check();LocalV2SDKChannel.Command command=loader.delivery.sdkCommand;require(command!=null&&command==sdkCollectionCommand&&command.id.equals(commandId)&&command.collectionKnown&&!command.returned&&command.running&&loader.worker==Thread.currentThread());}
        void collectionCommandJoined(String commandId) throws Exception {check();LocalV2SDKChannel.Command command=loader.delivery.sdkCommand;require(command!=null&&command==sdkCollectionCommand&&command.id.equals(commandId)&&command.collectionKnown&&command.returned&&command.resultClosed&&command.running&&loader.worker==Thread.currentThread());command.collectionJoined=true;}
        void collectionUnknown() throws Exception {check();loader.writer.unknown(loader.request);failed();}
        private java.util.Map<String,Object> sdkCollection(PlanetChildDataStore.Purpose purpose,Long revision,java.util.Map<String,byte[]> replacement) throws Exception {
            require(loader!=null&&loader.worker==Thread.currentThread()&&loader.delivery.sdkCommand!=null);LocalV2SDKChannel.Command command=loader.delivery.sdkCommand;
            require(command.running&&!command.returned&&(!command.collectionKnown||revision==null));if(revision!=null){require(sdkCollectionCommand==null);sdkCollectionCommand=command;}
            PlanetChildDataStore.CollectionResult result=loader.withData(this,()->store.admittedCollection(this,lease,purpose,revision,replacement,command.id));java.util.Map<String,byte[]> values=null;
            try{values=result.ownedValues();java.util.ArrayList<Object> refs=new java.util.ArrayList<>();
                for(java.util.Map.Entry<String,byte[]> entry:values.entrySet()){LocalV2AdmittedEnvelope.validate(compiled,purpose,entry.getKey(),entry.getValue(),wall());java.util.Map<String,Object> value=LocalV2PackageJson.object(LocalV2PackageJson.read(entry.getValue(),PlanetChildDataStore.MAX_VALUE_BYTES));
                    if(purpose==PlanetChildDataStore.Purpose.history)refs.addAll(LocalV2PackageJson.array(value.get("references"),100));
                    else{java.util.List<Object> rows=LocalV2PackageJson.array(value.get("entries"),4096);require(!rows.isEmpty());refs.add(LocalV2PackageJson.object(rows.get(0),"reference","payload").get("reference"));}}
                require(refs.size()<=(purpose==PlanetChildDataStore.Purpose.history?100:64));publication();java.util.Map<String,Object> response=LocalV2AppOwner.map("revision",result.revision,"references",refs);return publish(()->response);
            }catch(Exception error){failed();throw error;}finally{if(values!=null)for(byte[] bytes:values.values())LocalSnapshotV2.wipe(bytes);result.close();if(revision!=null){require(result.closedForSDK());command.resultClosed=true;}}
        }
        private void sdkCompleteCommand(LocalV2SDKChannel.Command command) throws Exception {
            if(sdkCollectionCommand==null)return;require(command==sdkCollectionCommand&&command.collectionKnown&&command.resultClosed&&command.returned);
            publication();loader.withData(this,()->{store.collectionComplete(this,lease,command.id);return null;});require(command.collectionJoined);sdkCollectionCommand=null;
        }

    }
    /** Final publication checks run after fresh canonical/UI IO. This leaf
     * grants no admission and never runs a main join under an ownership lock. */
    private static final class LocalV2AdmittedPublication {
        private static void check(LocalV2CompiledPackage compiled,java.util.concurrent.Callable<Long> clock,LocalV2PackageCompiler.Fence fresh) throws Exception {
            fresh.check();long now=clock.call();synchronized(compiled){require(!compiled.closed&&now>=0&&now<compiled.until);}
        }
    }
    private interface LocalV2DataWork<T>{T run() throws Exception;}
    private static final class LocalV2AdmittedResult implements AutoCloseable {
        private final LocalV2DataAdmission admission;private final PlanetChildDataStore.Result result;private final java.util.ArrayList<byte[]> borrowed=new java.util.ArrayList<>();private boolean closed;
        private LocalV2AdmittedResult(LocalV2DataAdmission admission,PlanetChildDataStore.Result result){this.admission=admission;this.result=result;}
        private byte[] copy(PlanetChildDataStore.Purpose purpose,String key) throws Exception {byte[] value=null;boolean handed=false;try{synchronized(this){require(!closed);}value=admission.loader.withData(admission,()->{try(PlanetChildDataStore.Slot slot=admission.store.admittedQuery(admission,admission.lease,result,purpose,key)){byte[] copy=slot.copyValue();boolean done=false;try{if(copy!=null)admission.validate(purpose,key,copy);done=true;return copy;}finally{if(!done)LocalSnapshotV2.wipe(copy);}}});admission.publication();final byte[] original=value;admission.publish(()->{synchronized(this){require(!closed&&borrowed.size()<64);if(original!=null)borrowed.add(original);return null;}});handed=true;return value;}catch(Exception failure){admission.failed();throw failure;}finally{if(!handed)LocalSnapshotV2.wipe(value);}}
        private long revision(PlanetChildDataStore.Purpose purpose,String key) throws Exception {try{synchronized(this){require(!closed);}long revision=admission.loader.withData(admission,()->{try(PlanetChildDataStore.Slot slot=admission.store.admittedQuery(admission,admission.lease,result,purpose,key)){return slot.revision;}});admission.publication();return admission.publish(()->{synchronized(this){require(!closed);return revision;}});}catch(Exception failure){admission.failed();throw failure;}}
        public synchronized void close(){closed=true;for(byte[] bytes:borrowed)LocalSnapshotV2.wipe(bytes);borrowed.clear();result.close();}
    }
    /** Concrete fixed producer shared by loader and future-profile Gate. The
     * Gate branch keeps its existing original mutation clock lease; neither
     * branch accepts a caller path, trust material, scope or admission boolean. */
    private static final class LocalV2FixedPackageProducer {
        private final LocalV2NativePackageLoader loader;private final LocalV2GateMutation mutation;private final LocalV2PackageProfile profile;
        private LocalV2FixedPackageProducer(LocalV2NativePackageLoader loader,LocalV2PackageProfile profile){this.loader=loader;mutation=null;this.profile=profile;}
        private LocalV2FixedPackageProducer(LocalV2GateMutation mutation,LocalV2PackageProfile profile){loader=null;this.mutation=mutation;this.profile=profile;}
        private void live() throws Exception {if(loader!=null)loader.live();else mutation.boundary();}
        private void fresh() throws Exception {if(loader!=null)loader.fresh(profile);else mutation.packageFresh();}
        private long wall() throws Exception {return loader!=null?loader.wall():mutation.packageWall();}
        private String territory() throws Exception {String territory=loader!=null?loader.territory:mutation.territory;require(territory!=null&&territory.equals(java.util.Locale.getDefault().getCountry()));return territory;}
        private byte[] asset(String fixed,int bound) throws Exception {if(loader!=null)return loader.fixedAsset(fixed,bound);live();require(fixed.equals("artifact.json")||fixed.equals("child-native/catalog-v1.json")||fixed.matches("child-native/(packages|reviews)/[a-f0-9]{64}\\.json"));byte[] owned=new byte[bound];int used=0;try(java.io.InputStream input=mutation.host.writer.vault.context.getAssets().open("public/"+fixed,android.content.res.AssetManager.ACCESS_STREAMING)){for(;;){live();if(used==bound){require(input.read()==-1);break;}int count=input.read(owned,used,Math.min(8192,bound-used));if(count<0)break;require(count>0);used+=count;}live();require(used>0);return java.util.Arrays.copyOf(owned,used);}finally{LocalSnapshotV2.wipe(owned);}}
        private LocalV2CompiledPackage compile() throws Exception {byte[] catalogBytes=null,artifactBytes=null;LocalV2CompiledPackage result=null;boolean handed=false;try{fresh();catalogBytes=asset("child-native/catalog-v1.json",65536);artifactBytes=asset("artifact.json",2097152);LocalV2PackageCatalog catalog=new LocalV2PackageCatalog(catalogBytes,artifactBytes,"android");require(!catalog.pins.isEmpty());
            for(Object row:catalog.pins){fresh();byte[] bytes=null,review=null;LocalV2CompiledPackage candidate=null;try{java.util.Map<String,Object> pin=LocalV2PackageJson.object(row);String sum=LocalV2PackageJson.hash(pin.get("packageChecksum")),reviewSum=LocalV2PackageJson.hash(pin.get("reviewChecksum"));bytes=asset("child-native/packages/"+sum+".json",8388608);review=asset("child-native/reviews/"+reviewSum+".json",524288);catalog.verify("child-native/packages/"+sum+".json",bytes,8388608);catalog.verify("child-native/reviews/"+reviewSum+".json",review,524288);java.util.Map<String,Object> audience=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,8388608));if(!profile.locale.equals(audience.get("locale"))||!Long.valueOf(profile.exactAge).equals(audience.get("exactAge"))||!profile.policyVersion.equals(audience.get("policyVersion"))||!profile.policyChecksum.equals(audience.get("policyChecksum")))continue;fresh();candidate=LocalV2PackageCompiler.compile(bytes,review,pin,catalog.keys,profile,catalog.platform,territory(),wall(),this::live);require(result==null);result=candidate;candidate=null;}finally{if(candidate!=null)candidate.close();LocalSnapshotV2.wipe(bytes);LocalSnapshotV2.wipe(review);}}
            require(result!=null);fresh();live();require(wall()<result.until);handed=true;return result;
        }finally{LocalSnapshotV2.wipe(catalogBytes);LocalSnapshotV2.wipe(artifactBytes);if(!handed&&result!=null)result.close();}}
    }

    private static LocalV2Writer actualSdkLocalV2Writer(PlanetChildVault vault) throws Exception {return new LocalV2Writer(vault);}

    /** Compiler-owned LOCAL2 operational policy; release review pins remain a
     * separate authenticated, deny-default input. No JS policy is consumed. */
    static final class LocalV2AppPolicy {
        static final String CANONICAL="{\"schemaVersion\":2,\"kind\":\"literary-planet-child-local-policy-v2\",\"version\":\"child-local-v2.1\",\"pinIterations\":600000,\"maxPinIterations\":1200000,\"backoffDelaysMs\":[1000,5000,15000,60000,300000]}";
        static String checksum() throws Exception {return digest(CANONICAL.getBytes(StandardCharsets.UTF_8));}
        private static LocalSnapshotV2Policy policy() throws Exception {return new LocalSnapshotV2Policy("child-local-v2.1",checksum(),1200000,new long[]{1000,5000,15000,60000,300000});}
    }
    private static final class LocalV2MissingPins extends Exception {}

    /** Native fixes the full target from the ORIGINAL securely read registry.
     * Web forms supply bounded deltas only; IDs, confirmation dates, age band
     * and complete protected profile bytes are never imported as permissions. */
    static final class LocalV2AppProfileDraft {
        private static final String[] DRAFT={"label","exactAge","locale","readingLevel","allowedTopics","blockedTopics","soundEnabled","motion","narrationEnabled"};
        private static String ageBand(long age) throws Exception {require(age>=3&&age<=17);return age<=5?"3-5":age<=8?"6-8":age<=11?"9-11":age<=14?"12-14":"15-17";}
        private static String confirmedAt() throws Exception {
            long wall=System.currentTimeMillis();require(wall>=0&&wall<=8640000000000000L);
            java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",java.util.Locale.ROOT);
            format.setLenient(false);format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));return format.format(new java.util.Date(wall));
        }
        private static java.util.Map<String,Object> exact(java.util.Map<String,Object> value,String... names) throws Exception {
            require(value!=null&&value.size()==names.length&&value.keySet().equals(new java.util.HashSet<>(Arrays.asList(names))));return value;
        }
        private static java.util.List<Object> topics(Object raw) throws Exception {
            java.util.List<Object> values=LocalV2PackageJson.array(raw,64);java.util.HashSet<String> seen=new java.util.HashSet<>();
            for(Object value:values){String topic=LocalV2PackageJson.text(value);require(topic.matches("[a-z0-9][a-z0-9._-]{0,63}")&&seen.add(topic));}return new java.util.ArrayList<>(values);
        }
        private static java.util.LinkedHashMap<String,Object> nativeProfile(java.util.Map<String,Object> proposal,String placeholder) throws Exception {
            exact(proposal,DRAFT);String label=LocalV2PackageJson.text(proposal.get("label")),locale=LocalV2PackageJson.text(proposal.get("locale"));
            long age=LocalV2PackageJson.number(proposal.get("exactAge"),3,17);
            require(label.length()>0&&label.length()<=80&&label.trim().equals(label)&&!label.matches("(?s).*[\\x00-\\x1f\\x7f].*")&&("ru".equals(locale)||"en".equals(locale)));
            Object reading=proposal.get("readingLevel");require(reading==null||Arrays.asList("plain","developing","fluent").contains(reading));
            Object allowed=proposal.get("allowedTopics");if(allowed!=null)allowed=topics(allowed);
            Object sound=proposal.get("soundEnabled"),narration=proposal.get("narrationEnabled"),motion=proposal.get("motion");
            require(sound instanceof Boolean&&narration instanceof Boolean&&Arrays.asList("system","calm").contains(motion));
            java.util.LinkedHashMap<String,Object> profile=new java.util.LinkedHashMap<>();
            profile.put("id",placeholder);profile.put("label",label);profile.put("exactAge",age);profile.put("ageBand",ageBand(age));
            profile.put("locale",locale);profile.put("ageConfirmedAt",confirmedAt());profile.put("readingLevel",reading);
            profile.put("allowedTopics",allowed);profile.put("blockedTopics",topics(proposal.get("blockedTopics")));
            profile.put("soundEnabled",sound);profile.put("motion",motion);profile.put("narrationEnabled",narration);
            // Child locale changes already require the original native Gate.
            profile.put("localeLocked",true);return profile;
        }
        static byte[] initial(java.util.Map<String,Object> proposal) throws Exception {
            byte[] bytes=LocalV2PackageJson.bytes(nativeProfile(proposal,"native-pending"),false);try{LocalV2InitialProfile.profileId(bytes);return bytes;}
            catch(Exception failure){LocalSnapshotV2.wipe(bytes);throw failure;}
        }
        static byte[] additional(java.util.Map<String,Object> proposal) throws Exception {
            java.util.Map<String,Object> profile=nativeProfile(proposal,"native-pending");profile.remove("id");
            java.util.LinkedHashMap<String,Object> wrapper=new java.util.LinkedHashMap<>();wrapper.put("createProfile",profile);
            return LocalV2PackageJson.bytes(wrapper,false);
        }
        private static java.util.Map<String,Object> selected(LocalSnapshotV2 current,String id) throws Exception {
            byte[] bytes=current.copy();try{
                java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,MAX_BYTES)),
                    record=LocalV2PackageJson.object(root.get("protectedRecord")),registry=LocalV2PackageJson.object(record.get("registry"));
                require(id!=null&&id.equals(registry.get("activeProfileId")));java.util.Map<String,Object> selected=null;
                for(Object raw:LocalV2PackageJson.array(registry.get("profiles"),4)){java.util.Map<String,Object> profile=LocalV2PackageJson.object(raw);if(id.equals(profile.get("id"))){require(selected==null);selected=new java.util.LinkedHashMap<>(profile);}}
                require(selected!=null);return selected;
            }finally{LocalSnapshotV2.wipe(bytes);}
        }
        static byte[] settings(LocalSnapshotV2 current,String action,java.util.Map<String,Object> target) throws Exception {
            if("change-exact-age".equals(action))exact(target,"profileId","exactAge");
            else if("change-blocked-topics".equals(action))exact(target,"profileId","blockedTopics");
            else exact(target,"profileId","changes");
            String id=LocalV2PackageJson.identifier(target.get("profileId"));java.util.Map<String,Object> profile=selected(current,id);
            if("change-exact-age".equals(action)){
                long age=LocalV2PackageJson.number(target.get("exactAge"),3,17);profile.put("exactAge",age);profile.put("ageBand",ageBand(age));profile.put("ageConfirmedAt",confirmedAt());
            }else if("change-blocked-topics".equals(action))profile.put("blockedTopics",topics(target.get("blockedTopics")));
            else{
                java.util.Map<String,Object> changes=LocalV2PackageJson.object(target.get("changes"));require(!changes.isEmpty()&&changes.size()<=6);
                for(java.util.Map.Entry<String,Object> change:changes.entrySet()){
                    String key=change.getKey();Object value=change.getValue();
                    if("readingLevel".equals(key))require(value==null||Arrays.asList("plain","developing","fluent").contains(value));
                    else if("allowedTopics".equals(key)){if(value!=null)value=topics(value);}
                    else if("locale".equals(key))require(Arrays.asList("ru","en").contains(value));
                    else if("soundEnabled".equals(key)||"narrationEnabled".equals(key))require(value instanceof Boolean);
                    else if("motion".equals(key))require(Arrays.asList("system","calm").contains(value));
                    else throw new PinKnownRefusal();profile.put(key,value);
                }
            }
            byte[] bytes=LocalV2PackageJson.bytes(profile,false);try{require(id.equals(LocalV2InitialProfile.profileId(bytes)));return bytes;}
            catch(Exception failure){LocalSnapshotV2.wipe(bytes);throw failure;}
        }
    }

    private interface SDKFirstInstallRecipient { void completed(SDKFirstInstallReceipt receipt) throws Exception; }
    /** A local storage completion, never a Parent Gate/action permission. Closing
     * only wipes; only settlement of the ORIGINAL receipt drains this owner. */
    private static final class SDKFirstInstallReceipt implements AutoCloseable {
        final SDKNativeChildFirstInstall owner; final SDKFirstInstallRequest request; final String checksum;
        private byte[] seed; private boolean disposed,settled;
        private SDKFirstInstallReceipt(SDKNativeChildFirstInstall owner,SDKFirstInstallRequest request) throws Exception {
            this.owner=owner;this.request=request;checksum=request.seed.checksum;seed=request.seed.copy();
        }
        private synchronized byte[] copySeed() throws Exception {require(!disposed);return seed.clone();}
        private synchronized void wipe(){disposed=true;Arrays.fill(seed,(byte)0);}
        public void close(){boolean original;synchronized(owner){original=owner.active==request && request.receipt==this;}
            if(original)owner.cancel(request);wipe();}
    }
    private static final class SDKFirstInstallRequest implements AutoCloseable {
        final SDKNativeChildFirstInstall owner; final android.app.Activity activity; final android.os.IBinder windowToken;
        final String locale; final LocalEmptySeedV2 seed; final long beganUptimeMs,deadlineUptimeMs;
        private final byte[] nonce,payload; final LocalV2ProcessClock processClock; final LocalV2ClockLease processLease; private byte[] keyEncoding,signature;
        private java.security.Signature originalSignature; private java.security.PublicKey publicKey;
        private android.hardware.biometrics.BiometricPrompt.CryptoObject originalCrypto;
        private android.os.CancellationSignal cancellation;
        private Thread worker; private SDKFirstInstallReceipt receipt;
        private boolean started,cancelled,sealed,finished,disposed,detached,promptOutstanding,credentialReturned,knownRefusal;
        private boolean mutationStarted,permissionConsumed,deliveryEntered,deliveryCompleted,cancelIssued;
        private boolean retirementClaimed,retired;
        private int mainCalls,eventCalls,cancelCalls,readCalls,settleCalls,cleanupCalls; private Exception failure;
        private SDKFirstInstallRequest(SDKNativeChildFirstInstall owner,android.app.Activity activity,String locale,
            String version,String policyChecksum,long timeout,android.os.IBinder token) throws Exception {
            this.owner=owner;this.activity=activity;this.locale=locale;windowToken=token;
            LocalSnapshotV2Policy policy=LocalV2AppPolicy.policy();require(version.equals(policy.version)&&policyChecksum.equals(policy.checksum));
            processClock=new LocalV2Writer(owner.vault).processClock(policy);processLease=processClock.claimUntil(this,owner.originalDeadline);
            beganUptimeMs=processLease.began;deadlineUptimeMs=processLease.deadline;
            seed=new LocalEmptySeedV2(version,policyChecksum);nonce=new byte[32];
            try{new java.security.SecureRandom().nextBytes(nonce);payload=SDKNativeChildFirstInstall.operation(this);}
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
    private static final class SDKNativeChildFirstInstall {
        private final PlanetChildVault vault; private volatile SDKFirstInstallRequest active; private boolean reserving,sealed; private final long originalDeadline;
        private final android.os.Handler mainHandler=new android.os.Handler(android.os.Looper.getMainLooper());
        private SDKNativeChildFirstInstall(PlanetChildVault vault,long deadline) throws Exception {require(vault!=null);this.vault=vault;originalDeadline=deadline;}
        private SDKFirstInstallRequest request(android.app.Activity activity,String locale,String version,String policyChecksum,long timeout) throws Exception {
            synchronized(this){require(active==null && !reserving && !sealed);reserving=true;}
            try{require(android.os.Build.VERSION.SDK_INT>=30 && android.os.Looper.myLooper()==android.os.Looper.getMainLooper()
                && activity!=null && activity.getClass()==MainActivity.class && activity.getApplicationContext()==vault.context
                && !activity.isFinishing() && !activity.isDestroyed() && activity.hasWindowFocus()
                && ("ru".equals(locale)||"en".equals(locale)) && timeout>0 && timeout<=60000);
                android.os.IBinder token=activity.getWindow().getDecorView().getWindowToken();require(token!=null);
                SDKFirstInstallRequest value=new SDKFirstInstallRequest(this,activity,locale,version,policyChecksum,timeout,token);
                synchronized(this){require(reserving && active==null && !sealed);active=value;reserving=false;}
                try{attach(value);}catch(Exception failure){synchronized(this){value.cancelled=true;value.sealed=true;sealed=true;}
                    try{removeObservers(value);}catch(Exception unknown){synchronized(this){value.sealed=true;}}
                    synchronized(this){value.finished=true;wipeIfIdle(value);notifyAll();}throw failure;}
                return value;
            }finally{synchronized(this){reserving=false;}}
        }
        private static byte[] operation(SDKFirstInstallRequest request) throws Exception {
            java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream(512);java.io.DataOutputStream out=new java.io.DataOutputStream(buffer);
            out.write("LP-LOCAL-FIRST-INSTALL\0v2\0".getBytes(StandardCharsets.US_ASCII));out.writeByte("ru".equals(request.locale)?1:2);
            for(String text:new String[]{request.owner.vault.vaultIdentity,request.seed.version,request.seed.policyChecksum,request.seed.checksum}) {
                byte[] raw=text.getBytes(StandardCharsets.US_ASCII);try{out.writeShort(raw.length);out.write(raw);}finally{Arrays.fill(raw,(byte)0);}}
            out.writeLong(request.beganUptimeMs);out.writeLong(request.deadlineUptimeMs);out.write(request.nonce);out.flush();return buffer.toByteArray();
        }
        private void own(SDKFirstInstallRequest request) throws Exception {require(request!=null && request.owner==this && active==request);}
        private void wipeIfIdle(SDKFirstInstallRequest request){if(request.finished && request.readCalls==0 && request.settleCalls==0
            && request.cleanupCalls==0 && request.eventCalls==0 && request.mainCalls==0 && request.cancelCalls==0
            && (request.cancelled || request.disposed || request.sealed))request.wipe();}
        private void live(SDKFirstInstallRequest request) throws Exception {
            synchronized(this){own(request);long now=request.processClock.current(request.processLease);if(sealed || request.cancelled || request.sealed || request.disposed || request.retirementClaimed || request.retired
                || now<request.beganUptimeMs || now>=request.deadlineUptimeMs)throw new PinKnownRefusal();
                byte[] actual=operation(request);try{require(MessageDigest.isEqual(actual,request.payload));}finally{Arrays.fill(actual,(byte)0);}}
        }
        private void main(SDKFirstInstallRequest request,Runnable body) throws Exception {
            synchronized(this){own(request);require(!request.detached || request.readCalls>0 || request.cleanupCalls>0);request.mainCalls++;}
            boolean accepted;try{accepted=mainHandler.post(()->{try{body.run();}catch(Throwable error){synchronized(this){request.sealed=true;request.cancelled=true;
                    request.failure=error instanceof Exception?(Exception)error:new Unavailable();notifyAll();}}
                finally{synchronized(this){request.mainCalls--;wipeIfIdle(request);notifyAll();}}});}
            catch(RuntimeException failure){synchronized(this){request.mainCalls--;request.sealed=true;notifyAll();}throw failure;}
            if(!accepted) {
                synchronized(this){request.mainCalls--;request.sealed=true;notifyAll();}throw new Unavailable();}
        }
        private void host(SDKFirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            for(;;){live(request);boolean[] valid={false},lost={false};
                main(request,()->{lost[0]=request.activity.isFinishing() || request.activity.isDestroyed()
                    || request.activity.getWindow().getDecorView().getWindowToken()!=request.windowToken;
                    valid[0]=!lost[0] && request.activity.hasWindowFocus();});
                synchronized(this){while(request.mainCalls!=0)wait();if(request.failure!=null)throw request.failure;live(request);
                    if(lost[0])throw new PinKnownRefusal();if(valid[0])return;
                    if(!request.credentialReturned)throw new PinKnownRefusal();wait(50);}}
        }
        private String signingAlias(SDKFirstInstallRequest request) throws Exception {return PinNativeOwnerAuthority.alias(request.activity);}
        /** No child file is opened as a candidate seed. All known v1/v2 and
         * child-data footprints are denied, including orphan backup/new files. */
        private void empty(File directory,KeyStore keys) throws Exception {
            require(!keys.containsAlias(vault.vaultIdentity+".aes"));noChildData(keys);
            for(String name:new String[]{"full-record-v1","full-record-v1.bak","full-record-v1.new","first-install-v2","first-install-v2.bak","first-install-v2.new","sdk-install-terminal-v2","sdk-install-terminal-v2.bak","sdk-install-terminal-v2.new"})
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
        private void prepareKey(SDKFirstInstallRequest request) throws Exception {
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
        private void authenticate(SDKFirstInstallRequest request,SDKFirstInstallRecipient recipient) throws Exception {
            require(recipient!=null);synchronized(this){own(request);live(request);require(!request.started && !request.finished);
                request.started=true;request.worker=new Thread(()->run(request,recipient),"planet-child-first-install");
                try{request.worker.start();}catch(RuntimeException error){request.sealed=true;sealed=true;request.finished=true;request.wipe();notifyAll();throw error;}}
        }
        private void terminal(SDKFirstInstallRequest request,android.hardware.biometrics.BiometricPrompt.AuthenticationResult result,Exception error) {
            synchronized(this){if(active!=request || request.detached || !request.promptOutstanding){request.sealed=true;request.cancelled=true;sealed=true;notifyAll();return;}
                request.promptOutstanding=false;request.credentialReturned=error==null && result!=null
                    && result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL
                    && result.getCryptoObject()==request.originalCrypto && result.getCryptoObject().getSignature()==request.originalSignature;
                if(!request.credentialReturned){request.cancelled=true;request.knownRefusal=true;}notifyAll();}
        }
        private void present(SDKFirstInstallRequest request) throws Exception {
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
        private void attach(SDKFirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());synchronized(this){own(request);require(!observerRegistered && !screenRegistered);}
            request.activity.getApplication().registerActivityLifecycleCallbacks(lifecycle);observerRegistered=true;
            request.activity.registerReceiver(screenOff,new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF));screenRegistered=true;
            require(mainHandler.postDelayed(deadlineCheck,50));
        }
        private void removeObservers(SDKFirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());mainHandler.removeCallbacks(deadlineCheck);
            if(screenRegistered){request.activity.unregisterReceiver(screenOff);screenRegistered=false;}
            if(observerRegistered){request.activity.getApplication().unregisterActivityLifecycleCallbacks(lifecycle);observerRegistered=false;}
            synchronized(this){request.detached=true;}
        }
        private void event(SDKFirstInstallRequest request,Runnable body){synchronized(this){if(active!=request || request.detached)return;request.eventCalls++;}
            try{body.run();}finally{synchronized(this){request.eventCalls--;wipeIfIdle(request);notifyAll();}}}
        private final Runnable deadlineCheck=new Runnable(){public void run(){SDKFirstInstallRequest request; synchronized(SDKNativeChildFirstInstall.this){request=active;}
            if(request==null)return;event(request,()->{if(SystemClock.elapsedRealtime()>=request.deadlineUptimeMs)cancel(request);
                synchronized(SDKNativeChildFirstInstall.this){if(!request.detached && !mainHandler.postDelayed(this,50)){request.sealed=true;request.cancelled=true;}}});}};
        private final android.content.BroadcastReceiver screenOff=new android.content.BroadcastReceiver(){
            public void onReceive(Context context,android.content.Intent intent){SDKFirstInstallRequest request=active;if(request!=null)event(request,()->cancel(request));}
        };
        private final android.app.Application.ActivityLifecycleCallbacks lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){
            public void onActivityCreated(android.app.Activity activity,android.os.Bundle state){}public void onActivityStarted(android.app.Activity activity){}
            public void onActivityResumed(android.app.Activity activity){}public void onActivitySaveInstanceState(android.app.Activity activity,android.os.Bundle state){}
            public void onActivityPaused(android.app.Activity activity){SDKFirstInstallRequest request=active;if(request!=null && request.activity==activity && request.promptOutstanding && !request.credentialReturned)return;lost(activity);}public void onActivityStopped(android.app.Activity activity){lost(activity);}
            public void onActivityDestroyed(android.app.Activity activity){lost(activity);}
        };
        private void lost(android.app.Activity activity){SDKFirstInstallRequest request=active;if(request!=null && request.activity==activity)event(request,()->cancel(request));}
        private void cancel(SDKFirstInstallRequest request){android.os.CancellationSignal signal;synchronized(this){if(request==null || active!=request || request.owner!=this)return;
                request.cancelled=true;request.knownRefusal=true;signal=request.cancellation;if(request.finished){wipeIfIdle(request);notifyAll();return;}
                if(request.cancelIssued){notifyAll();return;}request.cancelIssued=true;request.cancelCalls++;}
            Thread worker=new Thread(()->{try{if(signal!=null)signal.cancel();}catch(Throwable failure){synchronized(this){request.sealed=true;}}
                finally{synchronized(this){request.cancelCalls--;wipeIfIdle(request);notifyAll();}}},"planet-child-first-install-cancel");
            try{worker.start();}catch(RuntimeException failure){synchronized(this){request.cancelCalls--;request.sealed=true;notifyAll();}}}
        private void waitPrompt(SDKFirstInstallRequest request) throws Exception {
            for(;;){boolean expire;synchronized(this){if(!request.promptOutstanding && request.mainCalls==0)break;
                expire=!request.cancelled && SystemClock.elapsedRealtime()>=request.deadlineUptimeMs;if(!expire)wait(50);}if(expire)cancel(request);}
            synchronized(this){if(request.failure!=null)throw request.failure;live(request);require(request.credentialReturned);}
        }
        private void verify(SDKFirstInstallRequest request) throws Exception {
            live(request);require(request.signature!=null && request.signature.length>=8 && request.signature.length<=80 && request.publicKey!=null);
            byte[] encoded=request.publicKey.getEncoded();try{require(MessageDigest.isEqual(encoded,request.keyEncoding));}finally{Arrays.fill(encoded,(byte)0);}
            java.security.Signature check=java.security.Signature.getInstance("SHA256withECDSA");check.initVerify(request.publicKey);check.update(request.payload);require(check.verify(request.signature));live(request);
        }
        private static byte[] marker(SDKFirstInstallRequest request,boolean complete) throws Exception {
            byte[] value=new byte[1+request.payload.length];value[0]=(byte)(complete?2:1);System.arraycopy(request.payload,0,value,1,request.payload.length);return value;
        }
        private static void syncDirectory(File directory) throws Exception {
            FileDescriptor descriptor=Os.open(directory.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
            try{require(OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode));Os.fsync(descriptor);}finally{Os.close(descriptor);}
        }
        /** A failed terminal directory sync must retain a cold-start refusal marker. */
        private static void removeMarkerLast(File directory,File file,byte[] pending) throws Exception {
            try{Os.remove(file.getPath());syncDirectory(directory);}
            catch(Exception failure){
                try{boolean absent=false;try{Os.lstat(file.getPath());}catch(android.system.ErrnoException missing){require(missing.errno==OsConstants.ENOENT);absent=true;}
                    if(absent){FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
                        try(FileOutputStream stream=new FileOutputStream(fd)){stream.write(pending);stream.getFD().sync();}syncDirectory(directory);markerReadback(file,pending);}
                }catch(Exception sticky){failure.addSuppressed(sticky);}throw failure;
            }
        }
        private static void markerReadback(File file,byte[] expected) throws Exception {
            require(file.getAbsoluteFile().equals(file.getCanonicalFile()));FileDescriptor descriptor=Os.open(file.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
            byte[] actual=new byte[expected.length];try(FileInputStream input=new FileInputStream(descriptor)){StructStat opened=Os.fstat(descriptor),named=Os.lstat(file.getPath());
                require(OsConstants.S_ISREG(opened.st_mode) && opened.st_size==expected.length && opened.st_ino==named.st_ino && opened.st_dev==named.st_dev);int offset=0;
                while(offset<actual.length){int count=input.read(actual,offset,actual.length-offset);require(count>0);offset+=count;}require(input.read()==-1);require(MessageDigest.isEqual(actual,expected));
            }finally{Arrays.fill(actual,(byte)0);}
        }
        private void pending(File directory,SDKFirstInstallRequest request) throws Exception {
            File file=new File(directory,"first-install-v2");require(file.getAbsoluteFile().equals(file.getCanonicalFile()));byte[] value=marker(request,false);
            try{FileDescriptor descriptor=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
                synchronized(this){request.mutationStarted=true;}try(FileOutputStream output=new FileOutputStream(descriptor)){output.write(value);output.getFD().sync();}
                syncDirectory(directory);markerReadback(file,value);
            }finally{Arrays.fill(value,(byte)0);}
        }
        private void aes(KeyStore keys,SDKFirstInstallRequest request) throws Exception {
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
        private void commit(SDKFirstInstallRequest request) throws Exception {
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
        private void detach(SDKFirstInstallRequest request) throws Exception {
            main(request,()->{try{removeObservers(request);}catch(Exception failure){synchronized(this){request.sealed=true;request.failure=failure;notifyAll();}}});
            synchronized(this){while(request.mainCalls!=0 || request.eventCalls!=0 || request.cancelCalls!=0)wait();if(request.failure!=null)throw request.failure;}
        }
        private void run(SDKFirstInstallRequest request,SDKFirstInstallRecipient recipient) {
            try{prepareKey(request);present(request);waitPrompt(request);host(request);live(request);request.originalSignature.update(request.payload);
                request.signature=request.originalSignature.sign();verify(request);host(request);commit(request);
                synchronized(this){live(request);require(request.permissionConsumed);request.receipt=new SDKFirstInstallReceipt(this,request);request.deliveryEntered=true;}
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
        private void settle(SDKFirstInstallReceipt receipt,PinReplyDelivery delivery) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());SDKFirstInstallRequest request;
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
        private byte[] readInstalledSeed(SDKFirstInstallReceipt receipt) throws Exception {
            SDKFirstInstallRequest request;synchronized(this){require(receipt!=null && active!=null && receipt==active.receipt && receipt.owner==this
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
        /** The original successful worker, native input, callbacks, observer
         * removals and receipt settlement all join before signed encrypted
         * terminal publication. The external pending marker is removed LAST;
         * the original PROCESS lease remains occupied across that fence. */
        private void retire(SDKFirstInstallRequest request) throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            synchronized(this){own(request);require(!request.retirementClaimed&&!request.retired&&Thread.currentThread()!=request.worker);request.retirementClaimed=true;}
            if(request.worker!=null)request.worker.join();
            boolean known;synchronized(this){known=request.receipt!=null&&request.receipt.settled&&request.deliveryCompleted&&request.permissionConsumed&&!request.cancelled&&!request.sealed&&request.failure==null;}
            if(!known)cancel(request);
            try{
                synchronized(this){while(request.mainCalls!=0||request.eventCalls!=0||request.cancelCalls!=0||request.readCalls!=0||request.settleCalls!=0)wait(10);}
                if(!request.detached)detach(request);
                synchronized(this){require(request.detached&&request.mainCalls==0&&request.eventCalls==0&&request.cancelCalls==0&&request.cleanupCalls==0);}
                if(known){
                    java.util.concurrent.FutureTask<Boolean> host=new java.util.concurrent.FutureTask<>(()->!request.activity.isDestroyed()&&!request.activity.isFinishing()&&request.activity.hasWindowFocus()&&request.activity.getWindow().getDecorView().getWindowToken()==request.windowToken);
                    require(mainHandler.post(host));require(host.get());
                    vault.locked(directory->{request.processClock.current(request.processLease);verifyClosed(request);
                        byte[] seed=vault.readExact(directory),expected=request.seed.copy();
                        try{require(MessageDigest.isEqual(seed,expected));SDKInstallTerminal.complete(vault,directory,request,()->{request.processClock.current(request.processLease);verifyClosed(request);});}
                        finally{LocalSnapshotV2.wipe(seed);LocalSnapshotV2.wipe(expected);}return null;});
                }else if(request.mutationStarted||request.sealed)throw new Unavailable();
                request.processClock.release(request.processLease);
                synchronized(this){request.retired=true;request.finished=true;request.wipe();active=null;notifyAll();}
            }catch(Throwable failure){request.processClock.invalidate(request.processLease);synchronized(this){sealed=true;request.sealed=true;request.cancelled=true;request.wipe();notifyAll();}if(failure instanceof Error)throw(Error)failure;throw failure instanceof Exception?(Exception)failure:new Unavailable();}
        }
        private void verifyClosed(SDKFirstInstallRequest request) throws Exception {
            require(request.permissionConsumed&&request.deliveryCompleted&&request.receipt!=null&&request.receipt.settled&&request.detached&&!request.cancelled&&!request.sealed&&request.signature!=null);
            java.security.Signature verifier=java.security.Signature.getInstance("SHA256withECDSA");verifier.initVerify(request.publicKey);verifier.update(request.payload);require(verifier.verify(request.signature));
        }
    }


    /** Fixed encrypted terminal belongs to the native install key, namespace
     * and seed. Its authenticated bytes are never accepted from a bridge DTO. */
    private static final class SDKInstallTerminal {
        private static final String NAME="sdk-install-terminal-v2";
        private static void absent(File directory) throws Exception {
            for(String name:new String[]{NAME,NAME+".bak",NAME+".new"})SDKNativeChildFirstInstall.absent(new File(directory,name));
        }
        private static byte[] aad(PlanetChildVault vault){return(vault.vaultIdentity+"|LOCAL2|"+NAME).getBytes(StandardCharsets.UTF_8);}
        private static byte[] fileRead(File file,int max) throws Exception {
            require(file.getAbsoluteFile().equals(file.getCanonicalFile()));FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_RDONLY|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0);
            try(FileInputStream in=new FileInputStream(fd)){StructStat named=Os.lstat(file.getPath()),opened=Os.fstat(fd);require(OsConstants.S_ISREG(opened.st_mode)&&opened.st_size>0&&opened.st_size<=max&&named.st_ino==opened.st_ino&&named.st_dev==opened.st_dev);
                byte[] bytes=new byte[(int)opened.st_size];boolean handed=false;try{int at=0;while(at<bytes.length){int count=in.read(bytes,at,bytes.length-at);require(count>0);at+=count;}require(in.read()==-1);handed=true;return bytes;}finally{if(!handed)LocalSnapshotV2.wipe(bytes);}}
        }
        private static byte[] decrypt(PlanetChildVault vault,File directory) throws Exception {
            for(String suffix:new String[]{".bak",".new"})SDKNativeChildFirstInstall.absent(new File(directory,NAME+suffix));
            byte[] encoded=fileRead(new File(directory,NAME),4096),plain=null,associated=aad(vault);
            try{require(encoded.length>=30&&encoded[0]==2);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,vault.existingKey(),new GCMParameterSpec(128,Arrays.copyOfRange(encoded,1,13)));c.updateAAD(associated);plain=c.doFinal(encoded,13,encoded.length-13);require(plain.length>0&&plain.length<=2048);byte[] out=plain;plain=null;return out;}
            finally{LocalSnapshotV2.wipe(encoded);LocalSnapshotV2.wipe(plain);LocalSnapshotV2.wipe(associated);}
        }
        private static byte[] terminal(SDKFirstInstallRequest request) throws Exception {
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);
            out.writeInt(0x4c504932);out.writeShort(request.payload.length);out.write(request.payload);out.writeShort(request.keyEncoding.length);out.write(request.keyEncoding);out.writeShort(request.signature.length);out.write(request.signature);out.flush();return bytes.toByteArray();
        }
        private static void validate(PlanetChildVault vault,byte[] raw,LocalSnapshotV2Policy policy) throws Exception {
            byte[] payload=null,keyBytes=null,sig=null,seed=null;
            try(java.io.DataInputStream in=new java.io.DataInputStream(new java.io.ByteArrayInputStream(raw))){
                require(raw.length>0&&raw.length<=2048&&in.readInt()==0x4c504932);int n=in.readUnsignedShort();require(n>=100&&n<=1024);payload=new byte[n];in.readFully(payload);
                n=in.readUnsignedShort();require(n>0&&n<=512);keyBytes=new byte[n];in.readFully(keyBytes);n=in.readUnsignedShort();require(n>=8&&n<=80);sig=new byte[n];in.readFully(sig);require(in.read()==-1);
                KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,vault.context.getPackageName()+".literary-planet-child-device-owner-sign-v1");
                try{require(MessageDigest.isEqual(keyBytes,material.encoding));java.security.Signature verify=java.security.Signature.getInstance("SHA256withECDSA");verify.initVerify(material.publicKey);verify.update(payload);require(verify.verify(sig));}finally{LocalSnapshotV2.wipe(material.encoding);}
                try(java.io.DataInputStream p=new java.io.DataInputStream(new java.io.ByteArrayInputStream(payload))){
                    byte[] prefix=new byte["LP-LOCAL-FIRST-INSTALL\0v2\0".getBytes(StandardCharsets.US_ASCII).length];p.readFully(prefix);require(Arrays.equals(prefix,"LP-LOCAL-FIRST-INSTALL\0v2\0".getBytes(StandardCharsets.US_ASCII)));int locale=p.readUnsignedByte();require(locale==1||locale==2);
                    seed=LocalEmptySeedV2.canonical(policy.version,policy.checksum);
                    for(String expected:new String[]{vault.vaultIdentity,policy.version,policy.checksum,digest(seed)}){int count=p.readUnsignedShort();require(count==expected.length());byte[] value=new byte[count];try{p.readFully(value);require(expected.equals(new String(value,StandardCharsets.US_ASCII)));}finally{LocalSnapshotV2.wipe(value);}}
                    long began=p.readLong(),deadline=p.readLong();require(began>=0&&deadline>began&&deadline-began<=60000);byte[] nonce=new byte[32];try{p.readFully(nonce);require(p.read()==-1);}finally{LocalSnapshotV2.wipe(nonce);}
                }
            }finally{LocalSnapshotV2.wipe(payload);LocalSnapshotV2.wipe(keyBytes);LocalSnapshotV2.wipe(sig);LocalSnapshotV2.wipe(seed);}
        }
        private static void known(PlanetChildVault vault,File directory,LocalSnapshotV2Policy policy) throws Exception {
            for(String name:new String[]{"first-install-v2","first-install-v2.bak","first-install-v2.new","sdk-pin-pending-v2","sdk-pin-pending-v2.bak","sdk-pin-pending-v2.new"})SDKNativeChildFirstInstall.absent(new File(directory,name));
            byte[] value=decrypt(vault,directory);try{validate(vault,value,policy);}finally{LocalSnapshotV2.wipe(value);}
        }
        private static void complete(PlanetChildVault vault,File directory,SDKFirstInstallRequest request,CommitCheck boundary) throws Exception {
            absent(directory);byte[] pending=SDKNativeChildFirstInstall.marker(request,true),plain=terminal(request),encoded=null,associated=aad(vault),actual=null;
            try{boundary.check();SDKNativeChildFirstInstall.markerReadback(new File(directory,"first-install-v2"),pending);validate(vault,plain,LocalV2AppPolicy.policy());
                Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,vault.existingKey());require(c.getIV().length==12);c.updateAAD(associated);byte[] crypt=c.doFinal(plain);
                try{encoded=ByteBuffer.allocate(13+crypt.length).put((byte)2).put(c.getIV()).put(crypt).array();}finally{LocalSnapshotV2.wipe(crypt);}
                FileDescriptor fd=Os.open(new File(directory,NAME).getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);
                try(FileOutputStream stream=new FileOutputStream(fd)){stream.write(encoded);stream.getFD().sync();}
                SDKNativeChildFirstInstall.syncDirectory(directory);actual=decrypt(vault,directory);require(MessageDigest.isEqual(actual,plain));boundary.check();
                SDKNativeChildFirstInstall.markerReadback(new File(directory,"first-install-v2"),pending);boundary.check();
                SDKNativeChildFirstInstall.removeMarkerLast(directory,new File(directory,"first-install-v2"),pending);
                // No fallible native grant follows marker removal.
            }finally{LocalSnapshotV2.wipe(pending);LocalSnapshotV2.wipe(plain);LocalSnapshotV2.wipe(encoded);LocalSnapshotV2.wipe(associated);LocalSnapshotV2.wipe(actual);}
        }
    }



    /** Original SDK read permit stays inside its already-held Vault lock.
     * Structural DTOs, empty seeds and public factories cannot construct it. */
    static final class LocalV2SDKReadPermit {
        private final LocalV2Writer writer;private final LocalV2Request request;private final File directory;private final Thread thread;private final byte[] expected;private final LocalV2DataContext context;private final boolean empty;
        private LocalV2SDKReadPermit(LocalV2Writer writer,LocalV2Request request,File directory,byte[] actual) throws Exception {
            this.writer=writer;this.request=request;this.directory=directory;thread=Thread.currentThread();expected=actual.clone();
            java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(actual,MAX_BYTES)),p=root.containsKey("protectedRecord")?LocalV2PackageJson.object(root.get("protectedRecord")):root;
            empty=LocalV2PackageJson.array(LocalV2PackageJson.object(p.get("registry")).get("profiles"),4).isEmpty();
            if(empty)context=null;else try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(actual,request.policy)){context=new LocalV2DataContext(saved);}check();
        }
        void check() throws Exception {require(thread==Thread.currentThread()&&writer.active==request&&request.workers==1);writer.live(request);writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(expected,actual)&&request.currentBytes!=null&&MessageDigest.isEqual(actual,request.currentBytes));request.processClock.sample(request.processLease,actual);}finally{LocalSnapshotV2.wipe(actual);}}
        android.content.Context context() throws Exception {check();return writer.vault.context;}
        boolean emptyProfiles() throws Exception {check();return empty;}
        String binding() throws Exception {check();require(context!=null);return context.binding;}
        java.util.Map<String,String> profiles() throws Exception {check();return context==null?java.util.Collections.emptyMap():context.profiles;}
        String policyVersion() throws Exception {check();return request.policy.version;}String policyChecksum() throws Exception {check();return request.policy.checksum;}
        LocalV2KnownBirth knownBirth(String identity,byte[] plain) throws Exception {check();LocalV2KnownBirth birth=LocalV2KnownBirth.verify(writer.vault.context,identity,plain);require(request.policy.version.equals(birth.policyVersion)&&request.policy.checksum.equals(birth.policyChecksum)&&context!=null&&context.profiles.containsKey(birth.profileId));check();return birth;}
        private void close(){LocalSnapshotV2.wipe(expected);}
    }



    private static byte[] sdkRotate(LocalSnapshotV2 old,String salt,String credential,String hash) throws Exception {
        require(ProtectedEnvelope.hash(salt)&&ProtectedEnvelope.hash(credential)&&ProtectedEnvelope.hash(hash)&&!credential.equals(old.credentialId));
        byte[] bytes=old.copy(),p=null,pin=null;try{
            long revision=LocalSnapshotV2.increment(old.revision),pinRevision=LocalSnapshotV2.increment(old.pinRevision);
            String text="{\"schemaVersion\":1,\"policyVersion\":"+LocalSnapshotV2.quoted(old.policy.version)+",\"revision\":"+pinRevision+",\"credentialId\":"+LocalSnapshotV2.quoted(credential)+",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":"+LocalSnapshotV2.quoted(salt)+",\"hashHex\":"+LocalSnapshotV2.quoted(hash)+"},\"attempts\":{\"count\":"+old.count+",\"blockedUntilMs\":"+old.blockedUntilMs+",\"lastObservedMs\":"+old.lastObservedMs+",\"pendingAttemptId\":"+(old.pendingAttemptId==null?"null":LocalSnapshotV2.quoted(old.pendingAttemptId))+"}}";
            pin=text.getBytes(StandardCharsets.UTF_8);java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
            out.write(bytes,old.protectedStart,old.revisionStart-old.protectedStart);out.write(Long.toString(revision).getBytes(StandardCharsets.US_ASCII));
            out.write(bytes,old.revisionEnd,old.pinStart-old.revisionEnd);out.write(pin);out.write(bytes,old.pinEnd,old.protectedEnd-old.pinEnd);p=out.toByteArray();
            return LocalSnapshotV2.wire(p,old.policy,LocalSnapshotV2.increment(old.journalRevision),revision,pinRevision,credential,old.count,old.pendingAttemptId,old.savedCooldownMs,old.lastObservedMs);
        }finally{LocalSnapshotV2.wipe(bytes);LocalSnapshotV2.wipe(p);LocalSnapshotV2.wipe(pin);}
    }


    /** LOCAL-only successor: fixed native identity, genuine old PIN charge/math
     * for replacement, double new native input, existing OS owner-key signature
     * and full Root/J CAS/readback on one original PROCESS deadline. */
    private static final class LocalV2SDKPinRotation {
        final LocalV2Writer writer;final LocalV2Request request;final boolean recover;final String locale,id;private LocalV2PinKind kind;
        private final LocalV2GateRequest gate=null;private final long iterations=600000;
        private volatile Thread worker,settler,cancelWorker;private volatile boolean cancelled,finished,known,ownerReturned,promptOutstanding;
        private LocalV2PinPhase phase=LocalV2PinPhase.captured;private Exception failure;private boolean compared;private PinVerificationOutcome outcome;
        private byte[] original,nextBytes,payload,signature,keyEncoding;private java.security.Signature signing;private java.security.PublicKey publicKey;
        private android.hardware.biometrics.BiometricPrompt.CryptoObject crypto;private android.os.CancellationSignal signal;private Exception promptError;
        private android.app.Dialog dialog;private android.view.ViewTreeObserver.OnWindowFocusChangeListener focusObserver;
        private android.widget.TextView subtitle,mask,count;private android.widget.Button next;private android.widget.LinearLayout keypad;
        private final byte[] edit=new byte[128];private byte[] first,entered;private int length,stage;private boolean ready,uiJoined,shown,accepting,everFocused;
        private File pendingDirectory;private byte[] pendingBytes;
        private LocalV2SDKPinRotation(PlanetChildVault vault,android.app.Activity activity,LocalSnapshotV2Policy policy,long deadline,boolean recover,String locale) throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&("ru".equals(locale)||"en".equals(locale)));this.recover=recover;this.locale=locale;writer=new LocalV2Writer(vault);request=writer.requestAt(activity,policy,0,deadline);kind=LocalV2PinKind.verify;
            byte[] nonce=new byte[32];try{new java.security.SecureRandom().nextBytes(nonce);id=hex(nonce);}finally{LocalSnapshotV2.wipe(nonce);}
            synchronized(writer){writer.live(request);require(request.sdkRotation==null&&request.pinOperation==null);request.sdkRotation=this;request.processClock.claimPin(request.processLease,id,this);}
        }
        private void live() throws Exception {synchronized(writer){writer.live(request);require(request.sdkRotation==this&&!cancelled&&!Thread.currentThread().isInterrupted());}}
        private void originalReadback() throws Exception {live();writer.host(request);writer.vault.locked(directory->{live();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(original!=null&&MessageDigest.isEqual(original,actual)&&MessageDigest.isEqual(request.currentBytes,actual));request.processClock.sample(request.processLease,actual);return null;}finally{LocalSnapshotV2.wipe(actual);}});}
        private boolean ownedPrompt(){return phase==LocalV2PinPhase.owner&&promptOutstanding&&!ownerReturned&&!cancelled&&!finished&&crypto!=null&&crypto.getSignature()==signing;}
        private void revoke(){synchronized(writer){cancelled=true;accepting=false;LocalSnapshotV2.wipe(edit);length=0;if(signal!=null&&cancelWorker==null){request.pinCancelCalls++;cancelWorker=new Thread(()->{try{signal.cancel();}catch(Throwable error){writer.unknown(request);}finally{synchronized(writer){request.pinCancelCalls--;writer.notifyAll();}}},"planet-sdk-pin-cancel");cancelWorker.start();}writer.notifyAll();}}
        private void runJoined() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()&&worker==null);worker=new Thread(this::run,"planet-sdk-pin-successor");settler=new Thread(this::retire,"planet-sdk-pin-successor-retire");synchronized(writer){request.pinWorkers++;}worker.start();settler.start();join();}
        private void join() throws Exception {require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());if(settler!=null)settler.join();require(request.retired&&!request.sealed&&!request.processClock.invalid);if(failure!=null)throw failure;require(known);}
        private void joinedCleanup() throws Exception {if(settler!=null)settler.join();require(request.retired&&!request.sealed&&!request.processClock.invalid);}
        private void chargeBoundary() throws Exception {live();require(!recover&&worker==Thread.currentThread()&&phase==LocalV2PinPhase.charging&&uiJoined&&dialog==null&&entered!=null&&entered.length>0&&entered.length<=128);require(MessageDigest.isEqual(original,request.currentBytes));}
        private void exactCharged() throws Exception {live();LocalV2ChargedReservation reservation=request.reservation;require(reservation!=null&&!reservation.closed&&request.receipt==null&&!request.unacknowledgedMutation&&MessageDigest.isEqual(reservation.charged,request.currentBytes));writer.vault.locked(directory->{live();writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(actual,reservation.charged));return null;}finally{LocalSnapshotV2.wipe(actual);}});}
        private void run(){try{
            LocalV2StorageReceipt anchor=writer.reanchor(request);if(anchor!=null)writer.acknowledge(anchor);original=writer.sdkRead(request);
            if(!recover){input();phase=LocalV2PinPhase.charging;LocalV2StorageReceipt charge=writer.charge(request);writer.acknowledge(charge);LocalV2ChargedReservation reservation=request.reservation;require(reservation!=null);byte[] charged=reservation.charged.clone();
                try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(charged,request.policy)){phase=LocalV2PinPhase.comparing;exactCharged();outcome=LocalV2PinOperation.verifier(saved).compare(entered.clone(),this::exactCharged);compared=true;phase=LocalV2PinPhase.finalizing;LocalV2StorageReceipt finalized=writer.sdkFinalizeRotation(this);writer.acknowledge(finalized);if(outcome!=PinVerificationOutcome.match)throw new PinKnownRefusal();}
                finally{LocalSnapshotV2.wipe(charged);LocalSnapshotV2.wipe(entered);entered=null;LocalSnapshotV2.wipe(original);original=writer.sdkRead(request);}
            }
            kind=LocalV2PinKind.enroll;stage=0;ready=false;uiJoined=false;everFocused=false;LocalSnapshotV2.wipe(first);first=null;input();phase=LocalV2PinPhase.deriving;
            byte[] salt=new byte[32],credential=new byte[32],hash=new byte[32];
            try{RealPinPrimitivePlatform platform=new RealPinPrimitivePlatform();platform.random(salt);platform.random(credential);require(PinNativePrimitives.nonzero(salt)&&PinNativePrimitives.nonzero(credential));originalReadback();writer.begin(request);try{platform.derive(entered,salt,iterations,hash,this::live);}finally{writer.finish(request);}require(PinNativePrimitives.nonzero(hash));try(LocalSnapshotV2 old=LocalSnapshotV2.decode(original,request.policy)){nextBytes=sdkRotate(old,hex(salt),hex(credential),hex(hash));}}
            finally{LocalSnapshotV2.wipe(salt);LocalSnapshotV2.wipe(credential);LocalSnapshotV2.wipe(hash);}
            owner();verifyOwner(false);phase=LocalV2PinPhase.finalizing;LocalV2StorageReceipt receipt=writer.sdkCommitRotation(this);writer.acknowledge(receipt);live();known=true;
        }catch(Throwable error){failure=error instanceof Exception?(Exception)error:new Unavailable();if(request.unacknowledgedMutation||pendingBytes!=null)writer.unknown(request);revoke();}
        finally{try{cleanupInput();}catch(Throwable e){writer.unknown(request);failure=new Unavailable();}if(signal!=null&&cancelled)revoke();
            try{if(cancelWorker!=null){cancelWorker.join();cancelWorker=null;}synchronized(writer){while(promptOutstanding||request.events>0)writer.wait(10);}}catch(Exception e){writer.unknown(request);failure=e;}
            LocalSnapshotV2.wipe(edit);LocalSnapshotV2.wipe(first);LocalSnapshotV2.wipe(entered);synchronized(writer){finished=true;request.pinWorkers--;writer.notifyAll();}}}
        private void owner() throws Exception {
            originalReadback();require(android.os.Build.VERSION.SDK_INT>=30);phase=LocalV2PinPhase.owner;KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);String alias=PinNativeOwnerAuthority.alias(request.activity);require(keys.containsAlias(alias));PinOwnerSigningMaterial material=PinNativeOwnerAuthority.signingMaterial(keys,alias);
            signing=material.signature;publicKey=material.publicKey;keyEncoding=material.encoding;crypto=material.crypto;signal=new android.os.CancellationSignal();
            payload=message();writer.onMain(request,()->{try{live();android.hardware.biometrics.BiometricPrompt prompt=new android.hardware.biometrics.BiometricPrompt.Builder(request.activity)
                .setTitle("ru".equals(locale)?"Подтвердите новый родительский PIN":"Confirm the new Parent PIN").setSubtitle(label(R.string.native_owner_device_credential_reason))
                .setAllowedAuthenticators(android.hardware.biometrics.BiometricManager.Authenticators.DEVICE_CREDENTIAL).build();synchronized(writer){promptOutstanding=true;}
                prompt.authenticate(crypto,signal,task->{synchronized(writer){request.events++;}if(!writer.main.post(()->{try{task.run();}finally{synchronized(writer){request.events--;writer.notifyAll();}}}))synchronized(writer){request.events--;writer.unknown(request);}},
                    new android.hardware.biometrics.BiometricPrompt.AuthenticationCallback(){public void onAuthenticationSucceeded(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result){terminal(result,null);}public void onAuthenticationError(int code,CharSequence reason){terminal(null,new PinKnownRefusal());}});
            }catch(Exception error){promptError=error;cancelled=true;revoke();}},false);
            for(;;){synchronized(writer){if(!promptOutstanding&&request.events==0)break;writer.wait(10);}try{live();}catch(Exception e){revoke();}}
            if(cancelWorker!=null){cancelWorker.join();cancelWorker=null;}live();require(ownerReturned&&promptError==null);writer.host(request);signing.update(payload);signature=signing.sign();verifyOwner(false);
        }
        private void terminal(android.hardware.biometrics.BiometricPrompt.AuthenticationResult result,Exception error){synchronized(writer){if(request.detached||writer.active!=request||!promptOutstanding){writer.unknown(request);return;}promptOutstanding=false;promptError=error;ownerReturned=result!=null&&result.getAuthenticationType()==android.hardware.biometrics.BiometricPrompt.AUTHENTICATION_RESULT_TYPE_DEVICE_CREDENTIAL&&result.getCryptoObject()==crypto&&result.getCryptoObject().getSignature()==signing;if(!ownerReturned)cancelled=true;writer.notifyAll();}}
        private byte[] message() throws Exception {require(original!=null&&nextBytes!=null&&keyEncoding!=null);String[] fields={"LP-LOCAL-V2-SDK-PIN-ROTATE",id,recover?"recover":"replace",writer.vault.vaultIdentity,digest(original),digest(nextBytes),request.policy.version,request.policy.checksum,Long.toString(request.policy.maximumIterations),Arrays.toString(request.policy.delays),locale,Long.toString(request.began),Long.toString(request.deadline),digest(keyEncoding)};
            StringBuilder text=new StringBuilder();for(String field:fields)text.append(field.length()).append(':').append(field);return text.toString().getBytes(StandardCharsets.UTF_8);}
        private void verifyOwner(boolean storageLocked) throws Exception {
            if(storageLocked){writer.live(request);require(request.sdkRotation==this&&!cancelled);}else live();require(ownerReturned&&signature!=null&&signature.length>=8&&signature.length<=80&&uiJoined&&dialog==null&&worker==Thread.currentThread());
            byte[] actual=message(),encoding=publicKey.getEncoded();try{require(MessageDigest.isEqual(actual,payload)&&MessageDigest.isEqual(encoding,keyEncoding));java.security.Signature verify=java.security.Signature.getInstance("SHA256withECDSA");verify.initVerify(publicKey);verify.update(payload);require(verify.verify(signature));}finally{LocalSnapshotV2.wipe(actual);LocalSnapshotV2.wipe(encoding);}
        }
        private void pending(File directory) throws Exception {
            require(pendingBytes==null);verifyOwner(true);java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();java.io.DataOutputStream out=new java.io.DataOutputStream(bytes);out.writeInt(0x4c505332);out.writeUTF(id);out.writeUTF(digest(original));out.writeUTF(digest(nextBytes));out.writeShort(payload.length);out.write(payload);out.writeShort(signature.length);out.write(signature);out.flush();pendingBytes=bytes.toByteArray();pendingDirectory=directory;
            File file=new File(directory,"sdk-pin-pending-v2");SDKNativeChildFirstInstall.absent(file);FileDescriptor fd=Os.open(file.getPath(),OsConstants.O_WRONLY|OsConstants.O_CREAT|OsConstants.O_EXCL|OsConstants.O_NOFOLLOW|OsConstants.O_CLOEXEC,0600);try(FileOutputStream stream=new FileOutputStream(fd)){stream.write(pendingBytes);stream.getFD().sync();}SDKNativeChildFirstInstall.syncDirectory(directory);SDKNativeChildFirstInstall.markerReadback(file,pendingBytes);verifyOwner(true);
        }
        private void complete() throws Exception {
            require(known&&finished&&worker!=null&&!worker.isAlive()&&settler==Thread.currentThread()&&cancelWorker==null&&uiJoined&&dialog==null&&ownerReturned&&!promptOutstanding&&!cancelled&&request.detached&&request.retiring&&!request.sealed&&request.receipt==null&&!request.unacknowledgedMutation&&request.pinWorkers==0&&request.workers==0&&request.mainCalls==0&&request.events==0);
            writer.vault.locked(directory->{request.processClock.current(request.processLease);require(pendingDirectory.equals(directory)&&pendingBytes!=null);writer.completeRecord(directory);byte[] actual=writer.vault.readExact(directory);try{require(MessageDigest.isEqual(actual,nextBytes));request.processClock.inspect(request.processLease,actual);SDKNativeChildFirstInstall.markerReadback(new File(directory,"sdk-pin-pending-v2"),pendingBytes);request.processClock.current(request.processLease);SDKNativeChildFirstInstall.removeMarkerLast(directory,new File(directory,"sdk-pin-pending-v2"),pendingBytes);return null;}finally{LocalSnapshotV2.wipe(actual);}});
        }
        private void retire(){try{worker.join();if(cancelWorker!=null){cancelWorker.join();cancelWorker=null;}if(known)writer.sdkRetireRotation(this);else writer.retire(request);}catch(Throwable error){failure=error instanceof Exception?(Exception)error:new Unavailable();writer.unknown(request);}
            finally{LocalSnapshotV2.wipe(original);LocalSnapshotV2.wipe(nextBytes);LocalSnapshotV2.wipe(payload);LocalSnapshotV2.wipe(signature);LocalSnapshotV2.wipe(keyEncoding);LocalSnapshotV2.wipe(pendingBytes);synchronized(writer){request.sdkRotation=null;writer.notifyAll();}}}
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
        private void showNativeProfileTarget(android.content.Context ui,android.widget.LinearLayout content) throws Exception {
            if(gate==null||!"expand-access-settings".equals(gate.action)||!(gate.originalHostChallenge instanceof LocalV2GateInvocation))return;
            LocalV2GateInvocation invocation=(LocalV2GateInvocation)gate.originalHostChallenge;require(invocation.original==gate&&invocation.scope!=null&&digest(invocation.target).equals(gate.targetChecksum));
            java.util.Map<String,Object> value=LocalV2PackageJson.object(LocalV2PackageJson.read(invocation.target,65536));org.json.JSONObject profile=null;boolean creation=value.containsKey("createProfile"),ru="ru".equals(locale);
            if(creation){LocalV2PackageJson.object(value,"createProfile");require(invocation.generatedProfileId!=null);profile=new org.json.JSONObject(LocalV2PackageJson.json(value.get("createProfile"),false));require(profile.getString("id").equals(invocation.generatedProfileId));}
            else if(value.containsKey("profileId")){LocalV2PackageJson.object(value,"profileId");String id=LocalV2PackageJson.identifier(value.get("profileId"));org.json.JSONArray profiles=new org.json.JSONObject(new String(original,StandardCharsets.UTF_8)).getJSONObject("protectedRecord").getJSONObject("registry").getJSONArray("profiles");
                for(int i=0;i<profiles.length();i++){org.json.JSONObject candidate=profiles.getJSONObject(i);if(id.equals(candidate.getString("id"))){require(profile==null);profile=candidate;}}require(profile!=null);}
            else return;
            android.widget.TextView purpose=text(ui,16);purpose.setText(creation?(ru?"Подтвердите дополнительный локальный профиль и детский режим":"Confirm the additional local profile and child mode"):(ru?"Подтвердите выбранный детский профиль":"Confirm the selected child profile"));content.addView(purpose);
            String[][] fields={{"label","Имя","Label"},{"exactAge","Точный возраст","Exact age"},{"ageBand","Возрастная группа","Age band"},{"locale","Язык","Language"},{"ageConfirmedAt","Подтверждение возраста","Age confirmation"},
                {"readingLevel","Уровень чтения","Reading level"},{"allowedTopics","Разрешённые темы","Allowed topics"},{"blockedTopics","Закрытые темы","Blocked topics"},{"soundEnabled","Звук","Sound"},{"motion","Движение","Motion"},{"narrationEnabled","Озвучивание","Narration"},{"localeLocked","Фиксация языка","Language lock"}};
            for(String[] field:fields){android.widget.TextView row=text(ui,14);row.setText(field[ru?1:2]+": "+LocalV2ProfileOperation.confirmationValue(profile,field[0],ru));content.addView(row);}
        }
        private void presentInput(){try{live();android.content.Context ui=localeContext();dialog=new android.app.Dialog(request.activity);dialog.setCancelable(true);dialog.setCanceledOnTouchOutside(false);
                android.widget.LinearLayout content=new android.widget.LinearLayout(ui);content.setOrientation(android.widget.LinearLayout.VERTICAL);content.setPadding(dp(16),dp(16),dp(16),dp(16));content.setSaveEnabled(false);
                dialog.setOwnerActivity(request.activity);content.setFilterTouchesWhenObscured(true);if(android.os.Build.VERSION.SDK_INT>=26)content.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                android.graphics.drawable.GradientDrawable panel=new android.graphics.drawable.GradientDrawable();panel.setColor(0xff101827);panel.setCornerRadius(dp(22));content.setBackground(panel);
                android.widget.TextView title=text(ui,22);title.setText(label(R.string.native_pin_title));content.addView(title);
                if(gate!=null){android.widget.TextView actionLabel=text(ui,14);actionLabel.setText(label(PinVerificationNativeInput.actionResource(gate.action)));content.addView(actionLabel);showNativeProfileTarget(ui,content);}
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
        private void render(){int amount,current;synchronized(writer){amount=length;current=stage;}subtitle.setText(kind==LocalV2PinKind.verify ? ("ru".equals(locale)?"Текущий родительский PIN":"Current Parent PIN") : label(current==0?R.string.native_pin_fresh:R.string.native_pin_confirmation));
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
    }


    private interface LocalV2SDKCommand {Object run(LocalV2OwnedPackageDelivery original) throws Exception;}
    /** Commands execute on the ORIGINAL loader worker, whose original delivery
     * remains retained. Queue admission is correlation data, not a capability. */
    private static final class LocalV2SDKChannel {
        private static final class Command {final LocalV2SDKCommand body;final String id=LocalV2AppOwner.random(16);Object value;Exception failure;boolean done,collectionKnown,resultClosed,collectionJoined;volatile boolean running,returned;Command(LocalV2SDKCommand body){this.body=body;}}
        private final java.util.ArrayDeque<Command> commands=new java.util.ArrayDeque<>();private LocalV2OwnedPackageDelivery delivery;private boolean closing,ended;private Exception failure;
        private synchronized void failed(Throwable error){failure=error instanceof Exception?(Exception)error:new Unavailable();closing=true;ended=true;for(Command c:commands){c.failure=failure;c.done=true;}commands.clear();notifyAll();}
        private void serve(LocalV2OwnedPackageDelivery original) throws Exception {
            synchronized(this){require(delivery==null&&!closing);original.fence();delivery=original;notifyAll();}
            try{for(;;){Command command;synchronized(this){if(commands.isEmpty()&&!closing){long remaining=original.owner.request.deadline-SystemClock.elapsedRealtime();if(remaining<=0)throw new PinKnownRefusal();wait(Math.min(10,remaining));}if(closing)break;command=commands.isEmpty()?null:commands.removeFirst();}
                // Observe the actual original loader even when no JS command is queued;
                // release this condition before taking the original writer/process fence.
                original.owner.live();if(command==null)continue;
                try{original.fence();require(original.sdkCommand==null);original.sdkCommand=command;command.running=true;Object value=command.body.run(original);command.returned=true;original.fence();original.data.sdkCompleteCommand(command);original.fence();command.running=false;original.sdkCommand=null;synchronized(this){require(!closing);command.value=value;command.done=true;notifyAll();}}
                catch(Throwable error){synchronized(this){command.failure=error instanceof Exception?(Exception)error:new Unavailable();command.done=true;notifyAll();}throw error;}}
            }finally{synchronized(this){ended=true;for(Command c:commands){c.failure=new PinKnownRefusal();c.done=true;}commands.clear();notifyAll();}}
        }
        private synchronized LocalV2OwnedPackageDelivery ready(long deadline) throws Exception {while(delivery==null&&!ended&&!closing){long left=deadline-SystemClock.elapsedRealtime();if(left<=0)throw new PinKnownRefusal();wait(Math.min(10,left));}if(failure!=null)throw failure;require(delivery!=null&&!closing&&!ended);return delivery;}
        private Object invoke(LocalV2SDKCommand body) throws Exception {Command c=new Command(body);synchronized(this){require(delivery!=null&&!closing&&!ended&&commands.size()<64);commands.addLast(c);notifyAll();while(!c.done&&!ended)wait(10);if(c.failure!=null)throw c.failure;if(failure!=null)throw failure;require(c.done&&!closing);return c.value;}}
        private synchronized void post(LocalV2SDKCommand body) throws Exception {require(delivery!=null&&!closing&&!ended&&commands.size()<64);commands.addLast(new Command(body));notifyAll();} private synchronized void close(){closing=true;notifyAll();}
    }
    /** Native sibling of WebView owns an opaque cover and genuine action
     * controls. Route/control identity and original lifecycle are native facts. */
    static final class LocalV2AppOwner {
        interface Reply {void complete(java.util.Map<String,Object> value);}
        interface Invalidated {void receive(java.util.Map<String,Object> value);}
        final PlanetChildVault vault;final android.app.Activity activity;final LocalSnapshotV2Policy policy;
        private final android.os.Handler main=new android.os.Handler(android.os.Looper.getMainLooper());
        private final java.util.concurrent.ExecutorService io=java.util.concurrent.Executors.newSingleThreadExecutor(r->new Thread(r,"planet-child-local-sdk"));
        private final Invalidated invalidated;private final java.util.HashSet<String> seen=new java.util.HashSet<>();
        private android.widget.FrameLayout surface;private android.view.View cover;private android.widget.LinearLayout controls;private android.os.IBinder window;
        private android.app.Application.ActivityLifecycleCallbacks lifecycle;private android.content.BroadcastReceiver screen;
        private android.view.View.OnAttachStateChangeListener attachment;private androidx.activity.OnBackPressedCallback back;private Runnable expiry;
        private volatile boolean sealed,busy,disposed;private long generation;private volatile Context context;private volatile long mediaEpoch;private volatile PlanetChildMedia.Owner media;private volatile PlanetChildResources resourceRead;private Runnable mediaWatch;private final java.util.Set<String> retiredMedia=new java.util.HashSet<>();
        private LocalV2Writer reader;private LocalV2Request readRequest;private LocalV2NativePackageLoader loader;private LocalV2SDKChannel channel;
        private LocalV2GateHost gate;private LocalV2ProfileOperation profile;private LocalV2PinOperation enrollment;private LocalV2SDKPinRotation rotation;
        private SDKNativeChildFirstInstall install;private SDKFirstInstallRequest installRequest;
        private static final class Context {
            final String token,checksum,status;final long generation,deadline;final java.util.Map<String,Object> metadata;final java.util.List<Object> profiles;
            Context(String token,String checksum,String status,long generation,long deadline,java.util.Map<String,Object> metadata,java.util.List<Object> profiles){this.token=token;this.checksum=checksum;this.status=status;this.generation=generation;this.deadline=deadline;this.metadata=metadata;this.profiles=profiles;}
        }
        private LocalV2AppOwner(android.app.Activity activity,Invalidated invalidated) throws Exception {require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&activity!=null&&activity.getClass()==MainActivity.class&&invalidated!=null);this.activity=activity;this.invalidated=invalidated;vault=new PlanetChildVault(activity);policy=LocalV2AppPolicy.policy();}
        private static java.util.Map<String,Object> map(Object... pairs){java.util.LinkedHashMap<String,Object> row=new java.util.LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)row.put((String)pairs[i],pairs[i+1]);return row;}
        private static String random(int bytes){byte[] value=new byte[bytes];try{new java.security.SecureRandom().nextBytes(value);return LocalV2PinOperation.hex(value);}finally{LocalSnapshotV2.wipe(value);}}
        private <T>T main(java.util.concurrent.Callable<T> body) throws Exception {if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper())return body.call();java.util.concurrent.FutureTask<T> task=new java.util.concurrent.FutureTask<>(body);require(main.post(task));boolean interrupted=false;try{for(;;)try{return task.get();}catch(InterruptedException e){interrupted=true;}}finally{if(interrupted)Thread.currentThread().interrupt();}}
        private void attach() throws Exception {
            require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper()&&!disposed&&!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus());
            android.os.IBinder token=activity.getWindow().getDecorView().getWindowToken();require(token!=null);
            if(surface!=null){require(window==token&&surface.getWindowToken()==token&&surface.getRootView()==activity.getWindow().getDecorView());return;}
            window=token;android.view.View parent=activity.findViewById(android.R.id.content);require(parent instanceof android.view.ViewGroup&&!(parent instanceof android.webkit.WebView));
            surface=new android.widget.FrameLayout(activity);surface.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);surface.setClickable(false);
            cover=new android.view.View(activity);cover.setBackgroundColor(android.graphics.Color.rgb(6,15,30));cover.setClickable(true);
            surface.addView(cover,new android.widget.FrameLayout.LayoutParams(-1,-1));
            controls=new android.widget.LinearLayout(activity);controls.setOrientation(android.widget.LinearLayout.VERTICAL);controls.setPadding(28,28,28,28);controls.setBackgroundColor(android.graphics.Color.rgb(6,15,30));
            android.widget.FrameLayout.LayoutParams cp=new android.widget.FrameLayout.LayoutParams(-1,-2,android.view.Gravity.CENTER);surface.addView(controls,cp);controls.setVisibility(android.view.View.GONE);
            ((android.view.ViewGroup)parent).addView(surface,new android.view.ViewGroup.LayoutParams(-1,-1));
            lifecycle=new android.app.Application.ActivityLifecycleCallbacks(){public void onActivityCreated(android.app.Activity a,android.os.Bundle b){}public void onActivityStarted(android.app.Activity a){}public void onActivityResumed(android.app.Activity a){}
                public void onActivityPaused(android.app.Activity a){if(a==activity&&!ownedPrompt())invalidate("cancelled");}public void onActivityStopped(android.app.Activity a){if(a==activity)invalidate("cancelled");}
                public void onActivityDestroyed(android.app.Activity a){if(a==activity)dispose();}public void onActivitySaveInstanceState(android.app.Activity a,android.os.Bundle b){}};
            activity.getApplication().registerActivityLifecycleCallbacks(lifecycle);
            screen=new android.content.BroadcastReceiver(){public void onReceive(android.content.Context c,android.content.Intent i){invalidate("cancelled");}};android.content.IntentFilter filter=new android.content.IntentFilter(android.content.Intent.ACTION_SCREEN_OFF);
            if(android.os.Build.VERSION.SDK_INT>=33)activity.registerReceiver(screen,filter,android.content.Context.RECEIVER_NOT_EXPORTED);else activity.registerReceiver(screen,filter);
            attachment=new android.view.View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(android.view.View v){}public void onViewDetachedFromWindow(android.view.View v){invalidate("cancelled");}};surface.addOnAttachStateChangeListener(attachment);
            back=new androidx.activity.OnBackPressedCallback(true){public void handleOnBackPressed(){invalidate("cancelled");}};((MainActivity)activity).getOnBackPressedDispatcher().addCallback((MainActivity)activity,back);
        }
        private boolean ownedPrompt(){return installRequest!=null&&installRequest.promptOutstanding&&!installRequest.credentialReturned&&!installRequest.cancelled
            ||enrollment!=null&&enrollment.ownedOwnerPause()||profile!=null&&profile.ownedOwnerPause()||rotation!=null&&rotation.ownedPrompt();}
        private void cover() throws Exception {main(()->{if(surface!=null){cover.setVisibility(android.view.View.VISIBLE);controls.setVisibility(android.view.View.GONE);surface.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);}if(expiry!=null)main.removeCallbacks(expiry);return null;});}
        private void reveal() throws Exception {main(()->{require(surface!=null&&!disposed&&!sealed);controls.removeAllViews();controls.setVisibility(android.view.View.GONE);cover.setVisibility(android.view.View.GONE);surface.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO);return null;});}
        private android.widget.Button arm(String caption,Runnable action) throws Exception {require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());cover.setVisibility(android.view.View.VISIBLE);controls.removeAllViews();controls.setVisibility(android.view.View.VISIBLE);surface.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_AUTO);
            android.widget.TextView label=new android.widget.TextView(activity);label.setText(caption);label.setTextColor(android.graphics.Color.WHITE);label.setTextSize(20);controls.addView(label);
            android.widget.Button button=new android.widget.Button(activity);button.setText(caption);button.setMinHeight(48);controls.addView(button);if(action!=null)button.setOnClickListener(v->action.run());return button;}
        private void live(long deadline) throws Exception {require(!sealed&&!disposed&&SystemClock.elapsedRealtime()<deadline&&deadline-SystemClock.elapsedRealtime()<=60000);}
        private synchronized Context current(String token) throws Exception {require(!sealed&&!disposed&&context!=null&&context.token.equals(token));live(context.deadline);return context;}
        private static java.util.Map<String,Object> unavailable(String id,String reason){return map("version",2L,"requestId",id,"status","unavailable","reason",reason,"context",null,"profiles",java.util.Collections.emptyList());}
        private java.util.Map<String,Object> refusal(PlanetChildDataTransport.V2Request request,String reason){
            if("retire".equals(request.method))return map("version",2L,"requestId",request.id,"status","unavailable","contextToken",request.contextToken);
            if(java.util.Arrays.asList("readEntity","search","readCollection","writeCollection","listMedia","presentMedia","releaseMedia").contains(request.method)){
                Context active;synchronized(this){active=context;}
                return map("version",2L,"requestId",request.id,"status","unavailable","contextToken",request.contextToken,"generation",active==null?generation:active.generation,"value",null);
            }
            return unavailable(request.id,reason);
        }
        void execute(PlanetChildDataTransport.V2Request request,Reply reply){ long stamp;try{if("releaseMedia".equals(request.method)||java.util.Arrays.asList("bootstrap","perform","retire").contains(request.method))fastMediaConceal();stamp=mediaEpoch;}catch(Exception failure){sealed=true;reply.complete(refusal(request,"pending"));return;} final long capturedMediaEpoch=stamp;final boolean revocationOnly="releaseMedia".equals(request.method)&&request.presentationToken==null;
            boolean accepted;synchronized(this){accepted=!disposed&&(!busy||revocationOnly)&&!sealed&&seen.size()<2048&&seen.add(request.id);if(accepted&&!revocationOnly)busy=true;}
            if(!accepted){reply.complete(refusal(request,"pending"));return;}
            io.execute(()->{try{reply.complete(dispatch(request,capturedMediaEpoch));}
                catch(Throwable failure){try{cover();synchronized(this){context=null;}joinOwners();if(failure instanceof PinKnownRefusal&&"perform".equals(request.method)&&!sealed)reply.complete(bootstrap(request.id,0,"cancelled"));else reply.complete(refusal(request,sealed?"pending":failure instanceof PinKnownRefusal?"expired":"unavailable"));}
                    catch(Throwable cleanup){sealed=true;reply.complete(refusal(request,"pending"));}}
                finally{synchronized(this){if(!revocationOnly)busy=false;}}});
        }
        private java.util.Map<String,Object> dispatch(PlanetChildDataTransport.V2Request r,long mediaStamp) throws Exception {
            main(()->{attach();return null;});
            if("bootstrap".equals(r.method)){synchronized(this){require(context==null);}return bootstrap(r.id,0,null);}
            if("retire".equals(r.method)){Context old;synchronized(this){old=context;if(r.contextToken!=null)require(old!=null&&old.token.equals(r.contextToken));context=null;}cover();joinOwners();return map("version",2L,"requestId",r.id,"status","retired","contextToken",r.contextToken);}
            if("readContext".equals(r.method)){Context c=current(r.contextToken);fresh(c);return response(r.id,c,null);}
            if("perform".equals(r.method))return perform(r);
            Context c=current(r.contextToken);require("child".equals(c.status)&&channel!=null);Object value=channel.invoke(delivery->{original(c,delivery);Object out=java.util.Arrays.asList("listMedia","presentMedia","releaseMedia").contains(r.method)?mediaCommand(r,c,delivery,mediaStamp):LocalV2SDKData.perform(r,delivery);original(c,delivery);return out;});
            fresh(c);return map("version",2L,"requestId",r.id,"status","ok","contextToken",c.token,"generation",c.generation,"value",value);
        }
        private void original(Context c,LocalV2OwnedPackageDelivery delivery) throws Exception {current(c.token);require(loader==delivery.owner&&delivery.owner.request.deadline==c.deadline&&delivery.compiled.profile.recordChecksum.equals(c.checksum));delivery.fence();}
        private void fresh(Context c) throws Exception {live(c.deadline);if(channel!=null)channel.invoke(delivery->{original(c,delivery);return null;});else{require(reader!=null&&readRequest!=null);byte[] actual=reader.sdkRead(readRequest);try{require(digest(actual).equals(c.checksum));}finally{LocalSnapshotV2.wipe(actual);}}}
        private java.util.Map<String,Object> response(String id,Context c,String reason) throws Exception {live(c.deadline);java.util.Map<String,Object> m=new java.util.LinkedHashMap<>(c.metadata);m.put("remainingLifetimeMs",Math.max(1,c.deadline-SystemClock.elapsedRealtime()));return map("version",2L,"requestId",id,"status",c.status,"reason",reason==null&&"blocked-child".equals(c.status)?"missing-pins":reason,"context",m,"profiles",c.profiles);}
        private java.util.Map<String,Object> bootstrap(String id,long deadline,String reason) throws Exception {
            cover();joinOwners();main(()->{attach();return null;});
            boolean absence=vault.locked(directory->{KeyStore keys=KeyStore.getInstance("AndroidKeyStore");keys.load(null);try{new SDKNativeChildFirstInstall(vault,SystemClock.elapsedRealtime()+30000).empty(directory,keys);return true;}catch(Exception present){return false;}});
            if(absence){synchronized(this){context=null;}reveal();return map("version",2L,"requestId",id,"status","first-install-required","reason",null,"context",null,"profiles",java.util.Collections.emptyList());}
            vault.locked(directory->{SDKInstallTerminal.known(vault,directory,policy);return null;});
            reader=new LocalV2Writer(vault);readRequest=main(()->reader.requestAt(activity,policy,deadline==0?30000:0,deadline));long originalDeadline=readRequest.deadline;
            byte[] actual=reader.sdkOpen(readRequest);try{
                java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(actual,MAX_BYTES)),record;boolean seed;
                try(LocalEmptySeedV2 s=LocalEmptySeedV2.decode(actual,policy.version,policy.checksum)){seed=true;record=root;}catch(Exception enrolled){seed=false;try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(actual,policy)){record=LocalV2PackageJson.object(root.get("protectedRecord"));}}
                java.util.Map<String,Object> registry=LocalV2PackageJson.object(record.get("registry"));java.util.List<Object> profiles=new java.util.ArrayList<>();String locale=java.util.Locale.getDefault().getLanguage().equals("ru")?"ru":"en";String selected=registry.get("activeProfileId")==null?null:LocalV2PackageJson.identifier(registry.get("activeProfileId"));
                for(Object row:LocalV2PackageJson.array(registry.get("profiles"),4)){java.util.Map<String,Object> p=LocalV2PackageJson.object(row);String uid=LocalV2PackageJson.identifier(p.get("id"));profiles.add(map("id",uid,"label",LocalV2PackageJson.text(p.get("label")),"exactAge",LocalV2PackageJson.number(p.get("exactAge"),3,17),"locale",p.get("locale")));if(uid.equals(selected))locale=LocalV2PackageJson.text(p.get("locale"));}
                String mode=LocalV2PackageJson.text(record.get("mode")),status=seed?"unenrolled":mode;require("adult".equals(mode)||"child".equals(mode)&&selected!=null);
                reader.sdkInspectData(readRequest,actual);
                LocalV2CompiledPackage compiled=null;
                if("child".equals(status)){
                    boolean missing=reader.sdkCatalogMissingPins(readRequest);
                    if(missing)status="blocked-child";
                    else{
                        LocalV2SDKPackageHandoff handoff=reader.sdkPackageHandoff(readRequest,actual);channel=new LocalV2SDKChannel();LocalV2SDKChannel originalChannel=channel;
                        loader=main(()->new LocalV2NativePackageLoader(vault,activity,surface,policy,0,originalDeadline,originalChannel::serve,error->{originalChannel.failed(error);invalidate(error instanceof PinKnownRefusal?"expired":"unavailable");},handoff));
                        reader=null;readRequest=null;
                        main(()->{loader.start();return null;});LocalV2OwnedPackageDelivery delivery=channel.ready(originalDeadline);compiled=delivery.compiled;require(compiled.profile.recordChecksum.equals(digest(actual)));
                    }
                }
                String token=random(16);long sequence;synchronized(this){require(generation<MAX_SAFE&&!sealed);sequence=++generation;}
                java.util.Map<String,Object> metadata=map("token",token,"generation",sequence,"revision",LocalV2PackageJson.number(record.get("revision"),1,MAX_SAFE),"selectionRevision",LocalV2PackageJson.number(record.get("selectionRevision"),1,MAX_SAFE),"profileRevision",LocalV2PackageJson.number(record.get("profileRevision"),1,MAX_SAFE),"policyVersion",policy.version,"policyChecksum",policy.checksum,"mode",mode,"profileId",selected,"locale",locale,"package",compiled==null?null:map("id",compiled.packageId,"version",compiled.version,"checksum",compiled.checksum),"home",compiled==null?null:LocalV2AdmittedEnvelope.reference(compiled,compiled.home,System.currentTimeMillis()));
                Context c=new Context(token,digest(actual),status,sequence,originalDeadline,metadata,profiles);synchronized(this){context=c;}if(channel!=null)channel.invoke(delivery->{original(c,delivery);require(delivery.mediaOwner==null);delivery.mediaOwner=this;return null;});reveal();main(()->{expiry=()->invalidate("expired");require(main.postDelayed(expiry,Math.max(1,c.deadline-SystemClock.elapsedRealtime())));return null;});return response(id,c,reason);
            }finally{LocalSnapshotV2.wipe(actual);}
        }
        private java.util.Map<String,Object> perform(PlanetChildDataTransport.V2Request r) throws Exception {
            String action=r.action;Context prior="first-install".equals(action)?null:current(r.contextToken);if(prior!=null)fresh(prior);
            long deadline=prior==null?SystemClock.elapsedRealtime()+30000:prior.deadline;cover();synchronized(this){context=null;}joinOwners();live(deadline);
            if("first-install".equals(action)){require(r.contextToken==null);firstInstall(deadline,r.target);}
            else if("enroll-pin".equals(action)){require("unenrolled".equals(prior.status));enroll(deadline,(String)prior.metadata.get("locale"));}
            else if("replace-pin".equals(action)||"recover-pin".equals(action)){require(!"unenrolled".equals(prior.status));rotation=main(()->new LocalV2SDKPinRotation(vault,activity,policy,deadline,"recover-pin".equals(action),(String)prior.metadata.get("locale")));rotation.runJoined();rotation=null;}
            else if("create-profile".equals(action)&&prior.profiles.isEmpty()){require("adult".equals(prior.status));byte[] proposal=LocalV2AppProfileDraft.initial(r.target);try{profile=main(()->LocalV2ProfileOperation.startAt(vault,activity,policy,proposal,deadline,original->{}));profile.sdkJoin();profile=null;}finally{LocalSnapshotV2.wipe(proposal);}}
            else{
                String name=action;byte[] target=r.target==null?new byte[0]:LocalV2PackageJson.bytes(r.target,false);
                try{
                    if("create-profile".equals(action)){LocalSnapshotV2.wipe(target);target=LocalV2AppProfileDraft.additional(r.target);name="expand-access-settings";}
                    else if("enter-child".equals(action)){LocalV2AppProfileDraft.exact(r.target,"profileId");name="expand-access-settings";}
                    else if("change-exact-age".equals(action)||"change-blocked-topics".equals(action)||"expand-access-settings".equals(action)&&r.target!=null&&r.target.containsKey("changes")){byte[] before=vault.locked(directory->vault.readExact(directory));try(LocalSnapshotV2 saved=LocalSnapshotV2.decode(before,policy)){LocalSnapshotV2.wipe(target);target=LocalV2AppProfileDraft.settings(saved,action,r.target);}finally{LocalSnapshotV2.wipe(before);}}
                    final String originalAction=name;final byte[] originalTarget=target;java.util.concurrent.atomic.AtomicBoolean unsupported=new java.util.concurrent.atomic.AtomicBoolean();
                    gate=main(()->{android.widget.Button control=arm(actionCaption(originalAction,(String)prior.metadata.get("locale")),null);return new LocalV2GateHost(vault,activity,surface,control,policy,originalAction,originalTarget,1,1,deadline,(a,b)->{if(!LocalV2CanonicalTransition.handles(a)){unsupported.set(true);throw new PinKnownRefusal();}/* Preserve the original native control until sdkJoin has detached every Gate observer. */});});
                    gate.sdkAwait(deadline);gate.sdkJoin();gate=null;if(unsupported.get())return bootstrap(r.id,deadline,"unsupported");
                }finally{LocalSnapshotV2.wipe(target);}
            }
            return bootstrap(r.id,deadline,null);
        }
        private void firstInstall(long deadline,java.util.Map<String,Object> target) throws Exception {
            require(target==null);String locale="ru".equals(java.util.Locale.getDefault().getLanguage())?"ru":"en";install=new SDKNativeChildFirstInstall(vault,deadline);
            java.util.concurrent.CountDownLatch pressed=new java.util.concurrent.CountDownLatch(1);java.util.concurrent.atomic.AtomicReference<Exception> failure=new java.util.concurrent.atomic.AtomicReference<>();
            main(()->{arm("ru".equals(locale)?"Создать локальный профиль родителя":"Set up local parent access",()->{try{installRequest=install.request(activity,locale,policy.version,policy.checksum,Math.max(1,deadline-SystemClock.elapsedRealtime()));}catch(Exception e){failure.set(e);}finally{pressed.countDown();}});return null;});
            while(!pressed.await(10,java.util.concurrent.TimeUnit.MILLISECONDS))live(deadline);if(failure.get()!=null)throw failure.get();require(installRequest!=null);SDKFirstInstallReceipt[] receipt={null};
            install.authenticate(installRequest,value->{require(value!=null&&value.request==installRequest);receipt[0]=value;});installRequest.worker.join();require(receipt[0]!=null);install.settle(receipt[0],PinReplyDelivery.known);install.retire(installRequest);install=null;installRequest=null;
        }
        private void enroll(long deadline,String locale) throws Exception {
            LocalV2Writer writer=new LocalV2Writer(vault);LocalV2Request request=main(()->writer.requestAt(activity,policy,0,deadline));enrollment=writer.enrollmentOperation(request,new Object(),random(32),generation+1,locale,600000);
            LocalV2PinReply[] result={null};enrollment.start(reply->{require(reply!=null);result[0]=reply;});enrollment.worker.join();enrollment.joinCancel();require(result[0]!=null);enrollment.settle(result[0],PinReplyDelivery.known);require(enrollment.knownSettlement&&enrollment.request.retired&&!enrollment.request.sealed);enrollment=null;
        }

        /** Revocation-only native entry runs before busy/worker admission. */
        private long fastMediaConceal()throws Exception {
            PlanetChildMedia.Owner prior;PlanetChildResources reading;long stamp;synchronized(this){require(mediaEpoch<MAX_SAFE);stamp=++mediaEpoch;prior=media;reading=resourceRead;}if(reading!=null)reading.revoke();
            if(prior!=null)main(()->{prior.concealMain();return null;});return stamp;
        }
        private void retireResourceJoined()throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());PlanetChildResources reading;synchronized(this){reading=resourceRead;}
            if(reading!=null){reading.closeJoined();require(reading.knownClosed());synchronized(this){require(resourceRead==reading);resourceRead=null;}}
        }
        private void retireMediaJoined()throws Exception {
            retireResourceJoined();
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());PlanetChildMedia.Owner prior;synchronized(this){prior=media;}
            if(prior!=null){prior.closeJoined();require(prior.knownClosed());synchronized(this){require(media==prior);require(retiredMedia.size()<2048);retiredMedia.add(prior.token);media=null;}}
        }
        private void retireMediaBeforePackageRelease(LocalV2OwnedPackageDelivery original)throws Exception {
            require(original!=null&&original.mediaOwner==this&&original.owner==loader&&android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            // This terminal original-loader path joins the metadata callback too;
            // ordinary null-release leaves its existing expiry ceiling armed.
            main(()->{if(mediaWatch!=null){main.removeCallbacks(mediaWatch);mediaWatch=null;}return null;});
            retireMediaJoined();
        }
        private java.util.Map<String,Object> mediaUnavailable(String asset){return map("status","unavailable","presentationToken",null,"assetId",asset,"remainingLifetimeMs",0L);}

        private void armMediaExpiry(Context c,LocalV2OwnedPackageDelivery d)throws Exception {
            original(c,d);if(d.mediaAssets==null||d.mediaAssets.isEmpty())return;
            long first=Long.MAX_VALUE;for(LocalV2MediaAsset asset:d.mediaAssets.values()){java.util.Map<String,Object> binding=d.resourceCatalog.bindings.get(d.compiled.checksum+"/"+asset.assetId);long until=binding==null?asset.until:Math.min(asset.until,LocalV2PackageCompiler.epoch(binding.get("validUntilEpochMs")));first=Math.min(first,until);}
            final long until=first,admittedWall=d.owner.wall();
            main(()->{require(context==c&&loader==d.owner);if(mediaWatch!=null)return null;
                mediaWatch=new Runnable(){long last=admittedWall;public void run(){
                    if(context!=c||sealed||disposed)return;
                    long wall=System.currentTimeMillis();if(wall<last||wall>=until||SystemClock.elapsedRealtime()>=c.deadline){invalidate("expired");return;}last=wall;
                    if(!main.postDelayed(this,10))invalidate("pending");
                }};require(main.post(mediaWatch));return null;
            });original(c,d);
        }

        private Object mediaCommand(PlanetChildDataTransport.V2Request r,Context c,LocalV2OwnedPackageDelivery d,long stamp)throws Exception {
            original(c,d);require(d.mediaOwner==this);
            if("releaseMedia".equals(r.method)){
                String token=r.presentationToken;PlanetChildMedia.Owner prior;synchronized(this){prior=media;require(token==null||prior!=null&&prior.token.equals(token)||retiredMedia.contains(token));}
                if(prior!=null&&(token==null||prior.token.equals(token)))retireMediaJoined();original(c,d);return map("status","retired","presentationToken",token);
            }
            if(d.mediaAssets==null)d.mediaAssets=new LocalV2FixedMediaProducer(d).compile();armMediaExpiry(c,d);
            LocalV2MediaCompiler.owner(d,r.owner);
            if("listMedia".equals(r.method)){
                java.util.List<Object> result=new java.util.ArrayList<>();for(LocalV2MediaAsset asset:d.mediaAssets.values())
                    if(asset.owner.equals(r.owner)&&d.owner.wall()<asset.until){new LocalV2MediaPermit(this,c,d,asset,stamp).checkWorker();require(result.size()<64);result.add(asset.descriptor());}
                original(c,d);return result;
            }
            require("presentMedia".equals(r.method));
            if(stamp!=mediaEpoch)return mediaUnavailable(r.assetId);
            LocalV2MediaAsset asset=d.mediaAssets.get(r.assetId);require(asset!=null&&asset.owner.equals(r.owner));retireMediaJoined();
            PlanetChildMedia.Owner recipient=null;byte[] bytes=null;boolean handed=false;
            try{
                LocalV2MediaPermit permit=new LocalV2MediaPermit(this,c,d,asset,stamp);
                bytes=new LocalV2FixedMediaProducer(d).read(permit);recipient=PlanetChildMedia.Owner.decode(permit,bytes);bytes=null;
                recipient.publish(r.layout);original(c,d);permit.checkWorker();
                long remaining=Math.min(c.deadline-SystemClock.elapsedRealtime(),permit.outputUntil-d.owner.wall());require(remaining>0&&remaining<=60000);
                handed=true;return map("status","presented","presentationToken",recipient.token,"assetId",asset.assetId,"remainingLifetimeMs",remaining);
            }catch(LocalV2MediaRevoked revoked){if(recipient!=null){recipient.closeJoined();require(recipient.knownClosed());synchronized(this){if(media==recipient){retiredMedia.add(recipient.token);media=null;}}}return mediaUnavailable(r.assetId);}
            finally{LocalSnapshotV2.wipe(bytes);if(!handed&&recipient!=null&&!recipient.knownClosed()){try{recipient.closeJoined();}catch(Exception unknown){d.owner.writer.unknown(d.owner.request);throw unknown;}}}
        }

        private void joinOwners() throws Exception {
            require(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());
            main(()->{if(mediaWatch!=null){main.removeCallbacks(mediaWatch);mediaWatch=null;}return null;});
            if(reader!=null&&readRequest!=null&&readRequest.sdkPackageLoader!=null){loader=readRequest.sdkPackageLoader;reader=null;readRequest=null;}if(channel!=null)channel.close();if(loader!=null){LocalV2NativePackageLoader old=loader;main(()->{old.close();return null;});old.sdkJoin();loader=null;channel=null;}
            if(reader!=null){reader.retire(readRequest);reader=null;readRequest=null;}
            if(gate!=null){LocalV2GateHost old=gate;main(()->{old.close();return null;});old.sdkCleanupJoined();gate=null;}
            if(profile!=null){profile.revoke();profile.sdkCleanupJoined();profile=null;}
            if(rotation!=null){rotation.revoke();rotation.joinedCleanup();rotation=null;}
            if(enrollment!=null){LocalV2PinOperation old=enrollment;old.revoke();if(old.worker!=null)old.worker.join();old.joinCancel();if(old.reply!=null&&!old.reply.settled)old.settle(old.reply,PinReplyDelivery.uncertain);else if(!old.request.retired)old.writer.retire(old.request);require(!old.request.sealed);enrollment=null;}
            if(installRequest!=null&&!installRequest.retired){install.cancel(installRequest);if(installRequest.worker!=null)installRequest.worker.join();if(installRequest.receipt!=null&&!installRequest.receipt.settled)install.settle(installRequest.receipt,PinReplyDelivery.uncertain);install.retire(installRequest);install=null;installRequest=null;}
        }
        void invalidate(String reason){try{fastMediaConceal();}catch(Exception failure){sealed=true;}if(!java.util.Arrays.asList("cancelled","expired","unavailable","pending","corrupt").contains(reason))reason="unavailable";
            Context old;synchronized(this){old=context;context=null;sealed=true;}try{cover();}catch(Exception failure){sealed=true;}
            if(channel!=null)channel.close();if(loader!=null)loader.revoke();if(gate!=null)gate.revoke();if(profile!=null)profile.revoke();if(rotation!=null)rotation.revoke();if(enrollment!=null)enrollment.revoke();if(installRequest!=null)install.cancel(installRequest);if(reader!=null)try{reader.cancel(readRequest);}catch(Exception failure){reader.unknown(readRequest);}
            invalidated.receive(map("version",2L,"contextToken",old==null?null:old.token,"generation",old==null?generation:old.generation,"reason",reason));
            io.execute(()->{try{joinOwners();synchronized(this){if(!disposed)sealed=false;}}catch(Throwable failure){sealed=true;}});
        }
        private String actionCaption(String action,String locale) throws Exception {android.content.res.Configuration config=new android.content.res.Configuration(activity.getResources().getConfiguration());config.setLocales(new android.os.LocaleList(java.util.Locale.forLanguageTag(locale)));return activity.createConfigurationContext(config).getString(PinVerificationNativeInput.actionResource(action));}
        void hostPaused(){if(!ownedPrompt())invalidate("cancelled");}void hostStopped(){invalidate("cancelled");}void nativeRouteInput(){invalidate("cancelled");}void destroy(){dispose();}
        void dispose(){synchronized(this){if(disposed)return;disposed=true;}invalidate("cancelled");io.execute(()->{try{joinOwners();main(()->{if(expiry!=null)main.removeCallbacks(expiry);if(back!=null)back.remove();if(screen!=null)activity.unregisterReceiver(screen);if(lifecycle!=null)activity.getApplication().unregisterActivityLifecycleCallbacks(lifecycle);if(surface!=null){surface.removeOnAttachStateChangeListener(attachment);android.view.ViewParent p=surface.getParent();if(p instanceof android.view.ViewGroup)((android.view.ViewGroup)p).removeView(surface);}return null;});}catch(Throwable failure){sealed=true;}finally{io.shutdown();}});}
    }

    private static final class LocalV2MediaRevoked extends Exception {}
    /** Actual original SDK command, compiled package and native recipient own
     * this permit. No caller-created scope, token or callback can construct it. */
    static final class LocalV2MediaPermit {
        private final LocalV2AppOwner owner;private final LocalV2AppOwner.Context context;private final LocalV2OwnedPackageDelivery delivery;
        private final LocalV2SDKChannel.Command command;private final LocalV2MediaAsset asset;private final long epoch;private final String token;private long wallLast,outputUntil;
        private LocalV2MediaPermit(LocalV2AppOwner owner,LocalV2AppOwner.Context context,LocalV2OwnedPackageDelivery delivery,LocalV2MediaAsset asset,long epoch)throws Exception {
            owner.original(context,delivery);require(delivery.sdkCommand!=null&&delivery.sdkCommand.running&&!delivery.sdkCommand.returned&&delivery.mediaOwner==owner);
            this.owner=owner;this.context=context;this.delivery=delivery;this.asset=asset;this.epoch=epoch;command=delivery.sdkCommand;token=LocalV2AppOwner.random(16);wallLast=delivery.owner.wall();outputUntil=asset.until;checkWorker();require(delivery.resourceCatalog!=null);java.util.Map<String,Object> binding=delivery.resourceCatalog.resolve(this);if(binding!=null)outputUntil=Math.min(outputUntil,LocalV2PackageCompiler.epoch(binding.get("validUntilEpochMs")));checkWorker();
        }
        void checkWorker()throws Exception {owner.original(context,delivery);require(delivery.owner.worker==Thread.currentThread()&&delivery.sdkCommand==command&&command.running&&!command.returned);checkOutput();}
        synchronized void checkOutput()throws Exception {long wall=System.currentTimeMillis();if(wall<wallLast||wall<0||wall>8640000000000000L)throw new LocalV2MediaRevoked();wallLast=wall;if(owner.mediaEpoch!=epoch||owner.context!=context||owner.sealed||owner.disposed||delivery.owner.revoked||delivery.owner.closed||SystemClock.elapsedRealtime()>=context.deadline||System.currentTimeMillis()>=outputUntil)throw new LocalV2MediaRevoked();}
        void checkMain()throws Exception {require(android.os.Looper.myLooper()==android.os.Looper.getMainLooper());checkOutput();delivery.owner.current();require(owner.loader==delivery.owner&&owner.surface==delivery.owner.route&&owner.window==delivery.owner.window);}
        <T>T onMain(java.util.concurrent.Callable<T> work)throws Exception{return owner.main(work);}
        android.widget.FrameLayout surface(){return owner.surface;}String presentationToken(){return token;}String mime(){return asset.mime;}
        String altText(){return (String)asset.payload.get("altText");}String transcript(){return (String)asset.payload.get("transcript");}boolean russian(){return "ru".equals(delivery.compiled.profile.locale);}
        boolean audioAllowed(){return Boolean.TRUE.equals(delivery.compiled.profile.profile.get("soundEnabled"))&&Boolean.TRUE.equals(delivery.compiled.profile.profile.get("narrationEnabled"));}
        double nativeScale(java.util.Map<String,Object> geometry)throws Exception {
            checkMain();long vw=LocalV2PackageJson.number(geometry.get("viewportWidth"),1,8192),vh=LocalV2PackageJson.number(geometry.get("viewportHeight"),1,8192);
            android.webkit.WebView web=((MainActivity)owner.activity).getBridge().getWebView();require(web!=null&&web.getWindowToken()==owner.window&&web.getWidth()>0&&web.getHeight()>0);
            double scale=web.getScale();require(Double.isFinite(scale)&&scale>0&&Math.abs(web.getWidth()-vw*scale)<=2*scale&&Math.abs(web.getHeight()-vh*scale)<=2*scale);
            int[] a=new int[2],b=new int[2];web.getLocationInWindow(a);owner.surface.getLocationInWindow(b);require(a[0]==b[0]&&a[1]==b[1]);return scale;
        }
        void verifyEncoded(byte[] bytes)throws Exception {checkWorker();require(bytes!=null&&bytes.length==asset.bytes&&digest(bytes).equals(asset.sha256));}
        void registerMain(PlanetChildMedia.Owner recipient,android.view.View view,android.widget.FrameLayout.LayoutParams layout)throws Exception {checkMain();require(recipient!=null&&recipient.permit==this&&view!=null&&view.getParent()==null);synchronized(owner){checkOutput();require(owner.media==null);owner.media=recipient;owner.surface.addView(view,0,layout);checkMain();}}
        void nativePlay(PlanetChildMedia.Owner recipient)throws Exception {
            checkMain();require(audioAllowed()&&owner.media==recipient&&recipient.permit==this&&owner.channel!=null);
            owner.channel.post(actual->{owner.original(context,actual);require(actual==delivery&&owner.media==recipient);LocalV2MediaPermit play=new LocalV2MediaPermit(owner,context,actual,asset,epoch);recipient.beginNativePlayback(play);return null;});
        }
        boolean sameOutput(LocalV2MediaPermit other){return other!=null&&owner==other.owner&&context==other.context&&delivery==other.delivery&&asset==other.asset&&epoch==other.epoch;}
        void nativeStop(PlanetChildMedia.Owner recipient)throws Exception {checkMain();require(owner.media==recipient&&recipient.permit==this);owner.fastMediaConceal();owner.channel.post(actual->{owner.original(context,actual);require(actual==delivery);owner.retireMediaJoined();return null;});}
        void outputExpired(PlanetChildMedia.Owner recipient){if(owner.media==recipient)owner.invalidate("expired");}
        void unknown(){delivery.owner.writer.unknown(delivery.owner.request);owner.invalidate("pending");}
    }
    private static final class LocalV2MediaAsset {
        final String assetId,sha256,mime,path,manifestChecksum,reviewChecksum;final int bytes;final long from,until;final java.util.Map<String,Object> owner,entity,payload,policy;
        private LocalV2MediaAsset(java.util.Map<String,Object> row,long from,long until,String manifestChecksum,String reviewChecksum)throws Exception {
            assetId=LocalV2PackageJson.identifier(row.get("assetId"));sha256=LocalV2PackageJson.hash(row.get("sha256"));mime=LocalV2PackageJson.text(row.get("mime"));
            bytes=(int)LocalV2PackageJson.number(row.get("bytes"),1,"audio/wav".equals(mime)?25165824:33554432);this.from=from;this.until=until;this.manifestChecksum=manifestChecksum;this.reviewChecksum=reviewChecksum;policy=LocalV2PackageJson.object(row.get("policy"));
            owner=LocalV2PackageJson.object(row.get("owner"));entity=LocalV2PackageJson.object(row.get("entity"));payload=LocalV2PackageJson.object(row.get("payload"));
            path="child-native/media/assets/"+sha256+"."+LocalV2MediaCompiler.extension(mime);
        }
        private java.util.Map<String,Object> descriptor(){return LocalV2AppOwner.map("assetId",assetId,"owner",owner,"entity",entity,"mime",mime,"role",payload.get("role"),"altText",payload.get("altText"),"transcript",payload.get("transcript"));}
    }
    private static final class LocalV2FixedMediaProducer {
        final LocalV2OwnedPackageDelivery delivery;private LocalV2FixedMediaProducer(LocalV2OwnedPackageDelivery d)throws Exception{d.fence();delivery=d;}
        private byte[] fixed(String path,int bound)throws Exception {
            require(path.equals("artifact.json")||path.equals(PlanetChildResources.CATALOG)||path.equals("child-native/media/catalog-v2.json")||path.matches("child-native/media/(manifests|reviews)/[a-f0-9]{64}\\.json")||path.matches("child-native/media/assets/[a-f0-9]{64}\\.(png|jpg|webp|wav)"));
            delivery.fence();byte[] scratch=new byte[bound];int used=0;
            try(java.io.InputStream input=delivery.owner.writer.vault.context.getAssets().open("public/"+path,android.content.res.AssetManager.ACCESS_STREAMING)){
                for(;;){delivery.owner.live();if(used==bound){require(input.read()==-1);break;}int n=input.read(scratch,used,Math.min(8192,bound-used));if(n<0)break;require(n>0);used+=n;}
                delivery.fence();require(used>0);return java.util.Arrays.copyOf(scratch,used);
            }finally{LocalSnapshotV2.wipe(scratch);}
        }
        private java.util.LinkedHashMap<String,LocalV2MediaAsset> compile()throws Exception {
            byte[] catalog=null,artifact=null;try {
                catalog=fixed("child-native/media/catalog-v2.json",65536);artifact=fixed("artifact.json",2097152);
                LocalV2MediaCatalog registry=new LocalV2MediaCatalog(catalog,artifact,delivery.compiled.platform);
                java.util.LinkedHashMap<String,LocalV2MediaAsset> result=new java.util.LinkedHashMap<>();boolean selected=false;
                for(Object raw:registry.pins){delivery.fence();java.util.Map<String,Object> pin=LocalV2PackageJson.object(raw);
                    String sum=LocalV2PackageJson.hash(pin.get("manifestChecksum")),reviewSum=LocalV2PackageJson.hash(pin.get("reviewChecksum"));byte[] bytes=null,review=null;
                    try {bytes=fixed("child-native/media/manifests/"+sum+".json",524288);review=fixed("child-native/media/reviews/"+reviewSum+".json",524288);
                        registry.verify("child-native/media/manifests/"+sum+".json",bytes,524288);registry.verify("child-native/media/reviews/"+reviewSum+".json",review,524288);
                        java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,524288),LocalV2MediaCompiler.MANIFEST);registry.addManifest(root,pin);
                        if(!delivery.compiled.packageId.equals(root.get("packageId"))||!Long.valueOf(delivery.compiled.version).equals(root.get("packageVersion"))||!delivery.compiled.checksum.equals(root.get("packageChecksum"))
                            ||!delivery.compiled.profile.locale.equals(root.get("locale"))||!Long.valueOf(delivery.compiled.profile.exactAge).equals(root.get("exactAge")))continue;
                        if(!LocalV2MediaCompiler.readings(root.get("readingLevels")).contains(delivery.compiled.profile.reading))continue;
                        require(!selected);selected=true;result=LocalV2MediaCompiler.compile(bytes,review,pin,registry.keys,delivery,delivery.owner.wall());
                    }finally{LocalSnapshotV2.wipe(bytes);LocalSnapshotV2.wipe(review);}
                }registry.complete();delivery.fence();byte[] resource=null;try{resource=fixed(PlanetChildResources.CATALOG,524288);require(delivery.resourceCatalog==null);delivery.resourceCatalog=new LocalV2ResourceCatalog(resource,artifact,delivery.compiled.platform);}finally{LocalSnapshotV2.wipe(resource);}delivery.fence();return result;
            }finally{LocalSnapshotV2.wipe(catalog);LocalSnapshotV2.wipe(artifact);}
        }
        private byte[] read(LocalV2MediaPermit permit)throws Exception {
            permit.checkWorker();require(permit.delivery==delivery);PlanetChildResources reader=PlanetChildResources.original(new LocalV2ResourceClaim(permit));byte[] bytes=null;boolean kept=false;
            synchronized(permit.owner){permit.checkOutput();require(permit.owner.resourceRead==null);permit.owner.resourceRead=reader;}
            try{bytes=reader.readOwned();permit.verifyEncoded(bytes);permit.checkWorker();require(reader.knownClosed());kept=true;return bytes;}
            finally{if(!kept)LocalSnapshotV2.wipe(bytes);try{reader.closeJoined();require(reader.knownClosed());synchronized(permit.owner){require(permit.owner.resourceRead==reader);permit.owner.resourceRead=null;}}catch(Exception unknown){LocalSnapshotV2.wipe(bytes);delivery.owner.writer.unknown(delivery.owner.request);throw unknown;}}
        }
    }
    private static final class LocalV2MediaCatalog {
        final java.util.List<Object> keys,pins;private final java.util.Map<String,java.util.Map<String,Object>> inventory=new java.util.HashMap<>(),inputs=new java.util.HashMap<>(),outputs=new java.util.HashMap<>();
        private final java.util.Set<String> expected=new java.util.HashSet<>();
        private LocalV2MediaCatalog(byte[] catalogBytes,byte[] artifactBytes,String platform)throws Exception {
            java.util.Map<String,Object> catalog=LocalV2PackageJson.object(LocalV2PackageJson.read(catalogBytes,65536),"schemaVersion","kind","platform","mediaPinSourceChecksum","reviewKeys","manifests");
            java.util.Map<String,Object> artifact=LocalV2PackageJson.object(LocalV2PackageJson.read(artifactBytes,2097152));
            require(Long.valueOf(2).equals(catalog.get("schemaVersion"))&&"literary-planet-child-native-media-catalog-v2".equals(catalog.get("kind"))&&"literary-planet-bundled-native-preparation".equals(artifact.get("kind"))&&"android".equals(artifact.get("platform"))
                &&Boolean.FALSE.equals(artifact.get("releaseReady"))&&Boolean.FALSE.equals(artifact.get("productionActionsAuthorized")));
            boolean empty="dev".equals(artifact.get("channel"))&&catalog.get("platform")==null;
            require(empty||platform.equals(catalog.get("platform"))&&(("android-google".equals(platform)&&"googlePlay".equals(artifact.get("channel")))||("android-rustore".equals(platform)&&"ruStore".equals(artifact.get("channel")))));
            keys=LocalV2PackageJson.array(catalog.get("reviewKeys"),16);pins=LocalV2PackageJson.array(catalog.get("manifests"),32);require(!empty||keys.isEmpty()&&pins.isEmpty());require(pins.isEmpty()||!keys.isEmpty());
            java.util.HashSet<String> ids=new java.util.HashSet<>(),points=new java.util.HashSet<>(),sums=new java.util.HashSet<>();
            for(Object raw:keys){java.util.Map<String,Object> key=LocalV2PackageJson.object(raw,"keyId","reviewerId","publicKeyX963Hex");String id=LocalV2PackageJson.text(key.get("keyId")),point=LocalV2PackageJson.text(key.get("publicKeyX963Hex"));
                require(id.matches("child-media-review-[A-Za-z0-9_-]{1,48}")&&LocalV2PackageJson.identifier(key.get("reviewerId"))!=null&&point.matches("04[a-f0-9]{128}")&&ids.add(id)&&points.add(point));}
            ids.clear();for(Object raw:pins){java.util.Map<String,Object> pin=LocalV2PackageJson.object(raw,"manifestId","manifestVersion","manifestChecksum","reviewChecksum","packageId","packageVersion","packageChecksum");
                String id=LocalV2PackageJson.identifier(pin.get("manifestId")),sum=LocalV2PackageJson.hash(pin.get("manifestChecksum"));long version=LocalV2PackageJson.number(pin.get("manifestVersion"),1,MAX_SAFE);
                LocalV2PackageJson.identifier(pin.get("packageId"));LocalV2PackageJson.number(pin.get("packageVersion"),1,MAX_SAFE);LocalV2PackageJson.hash(pin.get("packageChecksum"));String review=LocalV2PackageJson.hash(pin.get("reviewChecksum"));
                require(ids.add(id+"/"+version)&&sums.add(sum));expected.add("child-native/media/manifests/"+sum+".json");expected.add("child-native/media/reviews/"+review+".json");}
            java.util.Map<String,Object> sourceInputs=LocalV2PackageJson.object(artifact.get("sourceInputs"),"sha256","files");LocalV2PackageJson.hash(sourceInputs.get("sha256"));
            for(Object raw:LocalV2PackageJson.array(sourceInputs.get("files"),20000)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"path","sha256");String name=LocalV2PackageJson.text(row.get("path"));LocalV2PackageJson.hash(row.get("sha256"));require(inputs.put(name,row)==null);}
            require(inputs.containsKey("scripts/mobile/native-child-media-assets.mjs"));
            for(Object raw:LocalV2PackageJson.array(artifact.get("inventory"),20000)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"path","bytes","sha256");String name=LocalV2PackageJson.text(row.get("path"));LocalV2PackageJson.number(row.get("bytes"),1,MAX_SAFE);LocalV2PackageJson.hash(row.get("sha256"));require(inventory.put(name,row)==null);}
            java.util.Map<String,Object> metadata=LocalV2PackageJson.object(artifact.get("childNativeMediaAssets"),"pinSource","outputs"),pin=LocalV2PackageJson.object(metadata.get("pinSource"),"path","sha256");
            String pinHash=LocalV2PackageJson.hash(catalog.get("mediaPinSourceChecksum"));require("src/child/childNativeMediaReleasePins.json".equals(pin.get("path"))&&pinHash.equals(pin.get("sha256"))&&inputs.containsKey(pin.get("path"))&&pinHash.equals(inputs.get(pin.get("path")).get("sha256")));
            for(Object raw:LocalV2PackageJson.array(metadata.get("outputs"),577)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"output","source","sourceSha256","transformation","outputSha256");String output=LocalV2PackageJson.text(row.get("output"));require(output.startsWith("child-native/media/")&&outputs.put(output,row)==null);}
            expected.add("child-native/media/catalog-v2.json");verify("child-native/media/catalog-v2.json",catalogBytes,65536);
        }
        private void verify(String path,byte[] bytes,int bound)throws Exception {java.util.Map<String,Object> row=inventory.get(path);require(row!=null&&bytes.length>0&&bytes.length<=bound&&bytes.length==LocalV2PackageJson.number(row.get("bytes"),1,bound)&&digest(bytes).equals(row.get("sha256")));provenance(path,digest(bytes));}
        private void provenance(String path,String hash)throws Exception {
            java.util.Map<String,Object> row=outputs.get(path);require(row!=null&&hash.equals(row.get("outputSha256"))&&inventory.containsKey(path)&&hash.equals(inventory.get(path).get("sha256")));
            String source;if(path.equals("child-native/media/catalog-v2.json"))source="src/child/childNativeMediaReleasePins.json";
            else if(path.matches("child-native/media/(manifests|reviews)/[a-f0-9]{64}\\.json"))source="src/child/media-release-material/"+hash+"/"+(path.contains("/manifests/")?"manifest.json":"review.json");
            else{require(path.matches("child-native/media/assets/[a-f0-9]{64}\\.(png|jpg|webp|wav)"));source="src/child/media-release-material/"+hash+"/asset."+path.substring(path.lastIndexOf('.')+1);}
            require(source.equals(row.get("source"))&&inputs.containsKey(source)&&inputs.get(source).get("sha256").equals(row.get("sourceSha256")));
            require(path.endsWith("catalog-v2.json")?"fixed-native-media-pin-projection-v2".equals(row.get("transformation")):"none".equals(row.get("transformation"))&&hash.equals(row.get("sourceSha256")));
        }
        private void addManifest(java.util.Map<String,Object> root,java.util.Map<String,Object> pin)throws Exception {
            require(root.get("manifestId").equals(pin.get("manifestId"))&&root.get("manifestVersion").equals(pin.get("manifestVersion"))&&root.get("packageId").equals(pin.get("packageId"))&&root.get("packageVersion").equals(pin.get("packageVersion"))&&root.get("packageChecksum").equals(pin.get("packageChecksum")));
            for(Object raw:LocalV2PackageJson.array(root.get("assets"),512)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"assetId","owner","entity","payload","policy","inventoryKey","sha256","bytes","mime");String hash=LocalV2PackageJson.hash(row.get("sha256")),mime=LocalV2PackageJson.text(row.get("mime")),path="child-native/media/assets/"+hash+"."+LocalV2MediaCompiler.extension(mime);
                long bytes=LocalV2PackageJson.number(row.get("bytes"),1,"audio/wav".equals(mime)?25165824:33554432);require(inventory.containsKey(path)&&bytes==LocalV2PackageJson.number(inventory.get(path).get("bytes"),1,33554432));provenance(path,hash);expected.add(path);require(expected.size()<=577);}
        }
        private void complete()throws Exception {require(outputs.keySet().equals(expected));for(String path:inventory.keySet())if(path.startsWith("child-native/media/"))require(expected.contains(path));}
    }
    private static final class LocalV2MediaCompiler {
        private static final java.util.Set<String> KINDS=new java.util.HashSet<>(java.util.Arrays.asList("image","narration","background","skin","stand","accessory"));
        private static final String[] MANIFEST={"schemaVersion","kind","manifestId","manifestVersion","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","readingLevels","validFromEpochMs","validUntilEpochMs","assets"};
        private static final String[] REVIEW={"schemaVersion","kind","keyId","reviewerId","manifestId","manifestVersion","manifestChecksum","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge","readingLevels","platforms","territories","reviewedAtEpochMs","validFromEpochMs","validUntilEpochMs","assetChecksums","signatureHex"};
        private static String extension(String mime)throws Exception{if("image/png".equals(mime))return "png";if("image/jpeg".equals(mime))return "jpg";if("image/webp".equals(mime))return "webp";require("audio/wav".equals(mime));return "wav";}
        private static java.util.Set<Object> readings(Object raw)throws Exception {java.util.HashSet<Object> result=new java.util.HashSet<>();for(Object value:LocalV2PackageJson.array(raw,4))require((value==null||java.util.Arrays.asList("plain","developing","fluent").contains(value))&&result.add(value));require(!result.isEmpty());return result;}
        private static void owner(LocalV2OwnedPackageDelivery d,java.util.Map<String,Object> ref)throws Exception {LocalV2PackageCompiler.ref(ref);byte[] bytes=d.copyEntity((String)ref.get("kind"),(String)ref.get("id"));try{require(digest(bytes).equals(LocalV2PackageJson.hash(ref.get("contentChecksum"))));}finally{LocalSnapshotV2.wipe(bytes);}}
        private static java.util.LinkedHashMap<String,LocalV2MediaAsset> compile(byte[] bytes,byte[] reviewBytes,java.util.Map<String,Object> pin,java.util.List<Object> keys,LocalV2OwnedPackageDelivery d,long now)throws Exception {
            d.fence();require(digest(bytes).equals(pin.get("manifestChecksum"))&&digest(reviewBytes).equals(pin.get("reviewChecksum")));
            java.util.Map<String,Object> root=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,524288),MANIFEST),review=LocalV2PackageJson.object(LocalV2PackageJson.read(reviewBytes,524288),REVIEW);
            require(Long.valueOf(2).equals(root.get("schemaVersion"))&&"literary-planet-child-native-media-manifest-v2".equals(root.get("kind"))&&Long.valueOf(2).equals(review.get("schemaVersion"))&&"literary-planet-child-native-media-review-v2".equals(review.get("kind")));
            for(String field:new String[]{"manifestId","manifestVersion","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","locale","exactAge"})require(root.get(field).equals(review.get(field)));
            require(pin.get("manifestId").equals(root.get("manifestId"))&&pin.get("manifestVersion").equals(root.get("manifestVersion"))&&pin.get("manifestChecksum").equals(review.get("manifestChecksum"))
                &&d.compiled.packageId.equals(root.get("packageId"))&&Long.valueOf(d.compiled.version).equals(root.get("packageVersion"))&&d.compiled.checksum.equals(root.get("packageChecksum"))
                &&d.compiled.profile.policyVersion.equals(root.get("policyVersion"))&&d.compiled.profile.policyChecksum.equals(root.get("policyChecksum"))&&d.compiled.profile.locale.equals(root.get("locale"))&&Long.valueOf(d.compiled.profile.exactAge).equals(root.get("exactAge")));
            java.util.Set<Object> audience=readings(root.get("readingLevels"));require(audience.contains(d.compiled.profile.reading)&&readings(review.get("readingLevels")).containsAll(audience));
            require(LocalV2PackageJson.text(review.get("keyId")).matches("child-media-review-[A-Za-z0-9_-]{1,48}")&&LocalV2PackageJson.identifier(review.get("reviewerId"))!=null&&LocalV2PackageCompiler.epoch(review.get("reviewedAtEpochMs"))<=now);
            LocalV2PackageCompiler.window(root,"validFromEpochMs","validUntilEpochMs",now);LocalV2PackageCompiler.window(review,"validFromEpochMs","validUntilEpochMs",now);
            java.util.Set<String> platforms=LocalV2PackageJson.strings(review.get("platforms"),3,"android-google|android-rustore|ios-ipados"),territories=LocalV2PackageJson.strings(review.get("territories"),676,"[A-Z]{2}");
            require(platforms.contains(d.compiled.platform)&&territories.contains(d.compiled.territory));LocalV2PackageCompiler.signatureDomain(review,keys,"LP-CHILD-NATIVE-MEDIA-REVIEW\0v2\0");d.fence();
            java.util.HashMap<String,java.util.Map<String,Object>> closure=new java.util.HashMap<>();for(Object raw:LocalV2PackageJson.array(review.get("assetChecksums"),512)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"assetId","ownerChecksum","entityChecksum","policyChecksum","binaryChecksum","bytes","mime");require(closure.put(LocalV2PackageJson.identifier(row.get("assetId")),row)==null);}
            java.util.List<Object> assets=LocalV2PackageJson.array(root.get("assets"),512);require(!assets.isEmpty()&&assets.size()==closure.size());
            java.util.LinkedHashMap<String,LocalV2MediaAsset> result=new java.util.LinkedHashMap<>();java.util.HashSet<String> relations=new java.util.HashSet<>();java.util.HashMap<String,String> inventory=new java.util.HashMap<>();
            long until=Math.min(d.compiled.until,Math.min(LocalV2PackageCompiler.epoch(root.get("validUntilEpochMs")),LocalV2PackageCompiler.epoch(review.get("validUntilEpochMs"))));
            for(Object raw:assets){d.fence();java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"assetId","owner","entity","payload","policy","inventoryKey","sha256","bytes","mime");
                String id=LocalV2PackageJson.identifier(row.get("assetId")),mime=LocalV2PackageJson.text(row.get("mime")),ext=extension(mime);
                java.util.Map<String,Object> owner=LocalV2PackageJson.object(row.get("owner"),"kind","id","contentChecksum");owner(d,owner);
                java.util.Map<String,Object> entity=LocalV2PackageJson.object(row.get("entity"),"kind","id","contentChecksum"),payload=LocalV2PackageJson.object(row.get("payload"),"role","altText","transcript","scriptId","scriptChecksum","performerId","qualityChecksum"),policy=LocalV2PackageJson.object(row.get("policy"));
                String kind=LocalV2PackageJson.text(entity.get("kind")),entityId=LocalV2PackageJson.identifier(entity.get("id")),contentHash=LocalV2PackageJson.hash(entity.get("contentChecksum"));require(KINDS.contains(kind));
                byte[] payloadBytes=LocalV2PackageJson.bytes(payload,true),ownerBytes=LocalV2PackageJson.bytes(owner,true),policyBytes=LocalV2PackageJson.bytes(policy,true);
                try{require(digest(payloadBytes).equals(contentHash));String alt=LocalV2PackageJson.text(payload.get("altText"));require(alt.length()>0&&alt.length()<=240&&!alt.matches("(?s).*[\\x00-\\x1f\\x7f].*"));
                    if(kind.equals("narration")){require("audio/wav".equals(mime)&&"narration".equals(payload.get("role")));String transcript=LocalV2PackageJson.text(payload.get("transcript"));require(transcript.length()>0&&transcript.length()<=32768&&!transcript.matches("(?s).*[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f\\x7f].*"));LocalV2PackageJson.identifier(payload.get("scriptId"));LocalV2PackageJson.identifier(payload.get("performerId"));require(digest(transcript.getBytes(StandardCharsets.UTF_8)).equals(LocalV2PackageJson.hash(payload.get("scriptChecksum"))));LocalV2PackageJson.hash(payload.get("qualityChecksum"));}
                    else{require(!"audio/wav".equals(mime)&&(kind.equals("image")?java.util.Arrays.asList("image","portrait").contains(payload.get("role")):kind.equals(payload.get("role"))));for(String field:new String[]{"transcript","scriptId","scriptChecksum","performerId","qualityChecksum"})require(payload.get(field)==null);}
                    require(kind.equals(policy.get("kind"))&&entityId.equals(policy.get("id")));LocalV2PackageCompiler.policyForKinds(policy,d.compiled.profile,d.compiled.platform,d.compiled.territory,now,contentHash,KINDS);
                    java.util.Map<String,Object> rights=LocalV2PackageJson.object(policy.get("rights"));require(LocalV2PackageJson.strings(rights.get("platforms"),4,"web-pwa|android-google|android-rustore|ios-ipados").containsAll(platforms)&&LocalV2PackageJson.strings(rights.get("territories"),676,"[A-Z]{2}").containsAll(territories));
                    long end=rights.get("expiresAt")==null?until:Math.min(until,LocalV2PackageCompiler.epoch(rights.get("expiresAt")));
                    String binary=LocalV2PackageJson.hash(row.get("sha256")),inventoryKey=LocalV2PackageJson.text(row.get("inventoryKey"));long size=LocalV2PackageJson.number(row.get("bytes"),1,"audio/wav".equals(mime)?25165824:33554432);
                    require(inventoryKey.matches("[a-z0-9][a-z0-9_-]{0,63}\\.(png|jpg|webp|wav)")&&inventoryKey.endsWith("."+ext)&&relations.add(owner.get("kind")+"/"+owner.get("id")+"/"+kind+"/"+entityId));
                    String identity=binary+"/"+size+"/"+mime;require(!inventory.containsKey(inventoryKey)||identity.equals(inventory.get(inventoryKey)));inventory.put(inventoryKey,identity);
                    java.util.Map<String,Object> signed=closure.get(id);require(signed!=null&&digest(ownerBytes).equals(signed.get("ownerChecksum"))&&contentHash.equals(signed.get("entityChecksum"))&&digest(policyBytes).equals(signed.get("policyChecksum"))&&binary.equals(signed.get("binaryChecksum"))&&Long.valueOf(size).equals(signed.get("bytes"))&&mime.equals(signed.get("mime")));
                    long from=Math.max(LocalV2PackageCompiler.epoch(root.get("validFromEpochMs")),Math.max(LocalV2PackageCompiler.epoch(review.get("validFromEpochMs")),LocalV2PackageCompiler.epoch(rights.get("validFrom"))));require(result.put(id,new LocalV2MediaAsset(row,from,end,LocalV2PackageJson.hash(pin.get("manifestChecksum")),LocalV2PackageJson.hash(pin.get("reviewChecksum"))))==null&&now<end);
                }finally{LocalSnapshotV2.wipe(payloadBytes);LocalSnapshotV2.wipe(ownerBytes);LocalSnapshotV2.wipe(policyBytes);}
            }d.fence();return result;
        }
    }

    /** Fixed source catalog cannot issue a live permission. */
    private static final class LocalV2ResourceCatalog {
        final java.util.Map<String,java.util.Map<String,Object>> origins=new java.util.LinkedHashMap<>(),bindings=new java.util.LinkedHashMap<>();
        private LocalV2ResourceCatalog(byte[] bytes,byte[] artifactBytes,String platform)throws Exception {
            java.util.Map<String,Object> catalog=LocalV2PackageJson.object(LocalV2PackageJson.read(bytes,524288),"schemaVersion","kind","platform","resourcePinSourceChecksum","origins","resources"),artifact=LocalV2PackageJson.object(LocalV2PackageJson.read(artifactBytes,2097152));
            require(Long.valueOf(2).equals(catalog.get("schemaVersion"))&&"literary-planet-child-native-resource-catalog-v2".equals(catalog.get("kind"))&&"literary-planet-bundled-native-preparation".equals(artifact.get("kind"))&&"android".equals(artifact.get("platform"))&&Boolean.FALSE.equals(artifact.get("releaseReady"))&&Boolean.FALSE.equals(artifact.get("productionActionsAuthorized")));
            boolean empty="dev".equals(artifact.get("channel"))&&catalog.get("platform")==null;
            require(empty||platform.equals(catalog.get("platform"))&&(("android-google".equals(platform)&&"googlePlay".equals(artifact.get("channel")))||("android-rustore".equals(platform)&&"ruStore".equals(artifact.get("channel")))));
            String pin=LocalV2PackageJson.hash(catalog.get("resourcePinSourceChecksum"));java.util.Map<String,Object> inputs=LocalV2PackageJson.object(artifact.get("sourceInputs"),"sha256","files");LocalV2PackageJson.hash(inputs.get("sha256"));java.util.Map<String,String> source=new java.util.HashMap<>();
            for(Object raw:LocalV2PackageJson.array(inputs.get("files"),20000)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"path","sha256");require(source.put(LocalV2PackageJson.text(row.get("path")),LocalV2PackageJson.hash(row.get("sha256")))==null);}
            require(source.containsKey("scripts/mobile/native-child-resource-assets.mjs")&&source.containsKey("src/child/childNativeResource.ts")&&pin.equals(source.get("src/child/childNativeResourceReleasePins.json")));
            java.util.Map<String,Object> metadata=LocalV2PackageJson.object(artifact.get("childNativeResourceAssets"),"pinSource","outputs"),pinRow=LocalV2PackageJson.object(metadata.get("pinSource"),"path","sha256");require("src/child/childNativeResourceReleasePins.json".equals(pinRow.get("path"))&&pin.equals(pinRow.get("sha256")));
            java.util.List<Object> outputs=LocalV2PackageJson.array(metadata.get("outputs"),1);require(outputs.size()==1);java.util.Map<String,Object> output=LocalV2PackageJson.object(outputs.get(0),"output","source","sourceSha256","transformation","outputSha256");String sum=digest(bytes);
            require(PlanetChildResources.CATALOG.equals(output.get("output"))&&pinRow.get("path").equals(output.get("source"))&&pin.equals(output.get("sourceSha256"))&&"fixed-native-resource-pin-projection-v2".equals(output.get("transformation"))&&sum.equals(output.get("outputSha256")));
            boolean found=false;java.util.HashSet<String> paths=new java.util.HashSet<>();for(Object raw:LocalV2PackageJson.array(artifact.get("inventory"),20000)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"path","bytes","sha256");String name=LocalV2PackageJson.text(row.get("path"));require(paths.add(name));LocalV2PackageJson.number(row.get("bytes"),1,MAX_SAFE);LocalV2PackageJson.hash(row.get("sha256"));if(name.startsWith("child-native/resources/")){require(!found&&name.equals(PlanetChildResources.CATALOG)&&Long.valueOf(bytes.length).equals(row.get("bytes"))&&sum.equals(row.get("sha256")));found=true;}}require(found);
            java.util.HashSet<String> addresses=new java.util.HashSet<>(),usedOrigins=new java.util.HashSet<>(),ids=new java.util.HashSet<>();
            for(Object raw:LocalV2PackageJson.array(catalog.get("origins"),8)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"id","origin","tlsPublicKeyX963Checksums");String id=LocalV2PackageJson.identifier(row.get("id")),origin=PlanetChildResources.canonicalOrigin(LocalV2PackageJson.text(row.get("origin")));require(origins.put(id,row)==null&&addresses.add(origin));java.util.HashSet<String> keys=new java.util.HashSet<>();for(Object key:LocalV2PackageJson.array(row.get("tlsPublicKeyX963Checksums"),4))require(keys.add(LocalV2PackageJson.hash(key)));require(!keys.isEmpty());}
            for(Object raw:LocalV2PackageJson.array(catalog.get("resources"),512)){java.util.Map<String,Object> row=LocalV2PackageJson.object(raw,"id","packageId","packageVersion","packageChecksum","policyVersion","policyChecksum","manifestChecksum","reviewChecksum","assetId","assetChecksum","assetBytes","mime","originId","path","validFromEpochMs","validUntilEpochMs");String id=LocalV2PackageJson.identifier(row.get("id")),packageHash=LocalV2PackageJson.hash(row.get("packageChecksum")),assetId=LocalV2PackageJson.identifier(row.get("assetId")),originId=LocalV2PackageJson.identifier(row.get("originId")),mime=LocalV2PackageJson.text(row.get("mime")),checksum=LocalV2PackageJson.hash(row.get("assetChecksum"));
                LocalV2PackageJson.identifier(row.get("packageId"));LocalV2PackageJson.number(row.get("packageVersion"),1,MAX_SAFE);LocalV2PackageJson.identifier(row.get("policyVersion"));for(String field:new String[]{"policyChecksum","manifestChecksum","reviewChecksum"})LocalV2PackageJson.hash(row.get(field));
                require(PlanetChildResources.canonicalPath(checksum,mime).equals(row.get("path"))&&origins.containsKey(originId)&&ids.add(id)&&bindings.put(packageHash+"/"+assetId,row)==null);LocalV2PackageJson.number(row.get("assetBytes"),1,"audio/wav".equals(mime)?25165824:33554432);require(LocalV2PackageCompiler.epoch(row.get("validFromEpochMs"))<LocalV2PackageCompiler.epoch(row.get("validUntilEpochMs")));usedOrigins.add(originId);
            }require(usedOrigins.equals(origins.keySet())&&(!empty||origins.isEmpty()&&bindings.isEmpty()));
        }
        private java.util.Map<String,Object> resolve(LocalV2MediaPermit permit)throws Exception {
            permit.checkWorker();require(permit.delivery.resourceCatalog==this&&permit.delivery.mediaAssets.get(permit.asset.assetId)==permit.asset);LocalV2MediaAsset a=permit.asset;LocalV2CompiledPackage p=permit.delivery.compiled;java.util.Map<String,Object> row=bindings.get(p.checksum+"/"+a.assetId);if(row==null)return null;
            require(p.packageId.equals(row.get("packageId"))&&Long.valueOf(p.version).equals(row.get("packageVersion"))&&p.checksum.equals(row.get("packageChecksum"))&&p.profile.policyVersion.equals(row.get("policyVersion"))&&p.profile.policyChecksum.equals(row.get("policyChecksum"))&&a.manifestChecksum.equals(row.get("manifestChecksum"))&&a.reviewChecksum.equals(row.get("reviewChecksum"))&&a.sha256.equals(row.get("assetChecksum"))&&Long.valueOf(a.bytes).equals(row.get("assetBytes"))&&a.mime.equals(row.get("mime")));
            long from=LocalV2PackageCompiler.epoch(row.get("validFromEpochMs")),until=LocalV2PackageCompiler.epoch(row.get("validUntilEpochMs")),now=permit.delivery.owner.wall();require(from>=a.from&&until<=a.until&&from<=now&&now<until);return row;
        }
    }
    /** Original private local continuation, never server/license authority. */
    static final class LocalV2ResourceClaim {
        private final LocalV2MediaPermit permit;private final LocalV2ResourceCatalog catalog;private final java.util.Map<String,Object> binding,origin;private final long until;
        private LocalV2ResourceClaim(LocalV2MediaPermit permit)throws Exception {require(permit!=null);permit.checkWorker();this.permit=permit;catalog=permit.delivery.resourceCatalog;require(catalog!=null);binding=catalog.resolve(permit);origin=binding==null?null:catalog.origins.get(binding.get("originId"));until=binding==null?permit.asset.until:Math.min(permit.asset.until,LocalV2PackageCompiler.epoch(binding.get("validUntilEpochMs")));require(binding==null||origin!=null);checkIssuerWorker();}
        void checkIssuerWorker()throws Exception {permit.checkWorker();require(permit.delivery.resourceCatalog==catalog&&permit.delivery.mediaAssets.get(permit.asset.assetId)==permit.asset);if(binding!=null){require(catalog.resolve(permit)==binding);require(origin==catalog.origins.get(binding.get("originId")));}PlanetChildResources.originalRemaining(permit.context.deadline,SystemClock.elapsedRealtime(),until,permit.delivery.owner.wall());}
        void checkRead(PlanetChildResources reader)throws Exception {require(reader!=null&&reader.ownsReadThread()&&permit.owner.resourceRead==reader&&permit.delivery.resourceCatalog==catalog&&permit.delivery.sdkCommand==permit.command&&permit.command.running&&!permit.command.returned);permit.checkOutput();PlanetChildResources.originalRemaining(permit.context.deadline,SystemClock.elapsedRealtime(),until,permit.delivery.owner.wall());}
        java.io.InputStream openBundle(PlanetChildResources reader)throws Exception {checkRead(reader);require(!remote());return permit.delivery.owner.writer.vault.context.getAssets().open("public/"+permit.asset.path,android.content.res.AssetManager.ACCESS_STREAMING);}
        boolean remote(){return binding!=null;}String origin(){return origin==null?null:(String)origin.get("origin");}String path(){return binding==null?null:(String)binding.get("path");}
        int bytes(){return permit.asset.bytes;}String checksum(){return permit.asset.sha256;}String mime(){return permit.asset.mime;}
        @SuppressWarnings("unchecked") java.util.List<String> tlsKeyChecksums(){return origin==null?java.util.Collections.emptyList():(java.util.List<String>)(java.util.List<?>)origin.get("tlsPublicKeyX963Checksums");}
    }
    static LocalV2AppOwner nativeAppOwner(android.app.Activity activity,LocalV2AppOwner.Invalidated invalidated) throws Exception {return new LocalV2AppOwner(activity,invalidated);}



    /** Native text DTO producer reads ONLY the authenticated compiled index,
     * and derives collection envelopes itself inside the original admission. */
    private static final class LocalV2SDKData {
        private static String reference(LocalV2OwnedPackageDelivery d,java.util.Map<String,Object> ref) throws Exception {d.fence();return LocalV2AdmittedEnvelope.checkedRef(d.compiled,ref,d.owner.wall());}
        private static java.util.Map<String,Object> payload(LocalV2OwnedPackageDelivery d,String key) throws Exception {
            d.fence();java.util.Map<String,Object> value=LocalV2AdmittedEnvelope.payload(d.compiled,key,d.owner.wall());LocalV2PackageJson.object(value,"title","text","terms","references");d.fence();return value;
        }
        private static PlanetChildDataStore.Purpose purpose(String collection) throws Exception {if("favorites".equals(collection))return PlanetChildDataStore.Purpose.cache;if("offline".equals(collection))return PlanetChildDataStore.Purpose.offline;require("recent".equals(collection));return PlanetChildDataStore.Purpose.history;}
        private static java.util.Map<String,byte[]> replacement(LocalV2OwnedPackageDelivery d,String collection,java.util.List<java.util.Map<String,Object>> refs) throws Exception {
            PlanetChildDataStore.Purpose purpose=purpose(collection);java.util.LinkedHashMap<String,byte[]> values=new java.util.LinkedHashMap<>();
            try{
                if(purpose==PlanetChildDataStore.Purpose.history){require(refs.size()<=100);java.util.ArrayList<Object> checked=new java.util.ArrayList<>();java.util.HashSet<String> unique=new java.util.HashSet<>();for(java.util.Map<String,Object> ref:refs){String key=reference(d,ref);require(key.startsWith("recent/")&&unique.add(key));checked.add(ref);}java.util.Map<String,Object> value=LocalV2AppOwner.map("schemaVersion",1L,"scope",LocalV2AdmittedEnvelope.scope(d.compiled),"references",checked);byte[] bytes=LocalV2PackageJson.bytes(value,false);String key=LocalV2AdmittedEnvelope.key(d.compiled,purpose,null);LocalV2AdmittedEnvelope.validate(d.compiled,purpose,key,bytes,d.owner.wall());values.put(key,bytes);}
                else for(java.util.Map<String,Object> ref:refs){String root=reference(d,ref);require(root.startsWith(("favorites".equals(collection)?"favorite":"offline-package")+"/"));String key=LocalV2AdmittedEnvelope.key(d.compiled,purpose,root);require(!values.containsKey(key));java.util.Map<String,Object> value=LocalV2AppOwner.map("schemaVersion",1L,"scope",LocalV2AdmittedEnvelope.scope(d.compiled),"entries",LocalV2AdmittedEnvelope.closure(d.compiled,root,d.owner.wall()));byte[] bytes=LocalV2PackageJson.bytes(value,false);try{LocalV2AdmittedEnvelope.validate(d.compiled,purpose,key,bytes,d.owner.wall());values.put(key,bytes);bytes=null;}finally{LocalSnapshotV2.wipe(bytes);}}
                return values;
            }catch(Exception error){for(byte[] bytes:values.values())LocalSnapshotV2.wipe(bytes);throw error;}
        }
        private static java.util.Map<String,Object> collection(LocalV2OwnedPackageDelivery d,String collection,Long expected,java.util.List<java.util.Map<String,Object>> refs) throws Exception {
            d.fence();java.util.Map<String,byte[]> values=expected==null?null:replacement(d,collection,refs);try{return d.data.sdkCollection(purpose(collection),expected,values);}finally{if(values!=null)for(byte[] bytes:values.values())LocalSnapshotV2.wipe(bytes);}
        }
        private static java.util.List<java.util.Map<String,Object>> checkedRefs(Object value,int maximum) throws Exception {
            java.util.ArrayList<java.util.Map<String,Object>> out=new java.util.ArrayList<>();for(Object raw:LocalV2PackageJson.array(value,maximum))out.add(LocalV2PackageJson.object(raw,"kind","id","contentChecksum"));return out;
        }
        private static void remember(LocalV2OwnedPackageDelivery d,String viewed) throws Exception {
            String recent=null;for(String key:d.compiled.payloads.keySet())if(key.startsWith("recent/")){java.util.Map<String,Object> wrapper=payload(d,key);boolean linked=false;for(Object raw:LocalV2PackageJson.array(wrapper.get("references"),64))if(viewed.equals(LocalV2AdmittedEnvelope.checkedRef(d.compiled,raw,d.owner.wall())))linked=true;if(linked){require(recent==null);recent=key;}}
            if(recent==null)return;java.util.Map<String,Object> current=collection(d,"recent",null,null);java.util.List<java.util.Map<String,Object>> old=checkedRefs(current.get("references"),100),next=new java.util.ArrayList<>();java.util.Map<String,Object> latest=LocalV2AdmittedEnvelope.reference(d.compiled,recent,d.owner.wall());next.add(latest);for(java.util.Map<String,Object> row:old)if(!row.equals(latest)&&next.size()<100)next.add(row);
            if(!next.equals(old))collection(d,"recent",LocalV2PackageJson.number(current.get("revision"),0,MAX_SAFE),next);
        }
        static Object perform(PlanetChildDataTransport.V2Request request,LocalV2OwnedPackageDelivery d) throws Exception {
            d.fence();switch(request.method){
            case "readEntity":String key=reference(d,request.reference);java.util.Map<String,Object> value=payload(d,key);remember(d,key);d.fence();return LocalV2AppOwner.map("reference",request.reference,"payload",value);
            case "search":java.util.ArrayList<Object> matches=new java.util.ArrayList<>();String query=request.query.trim().toLowerCase(java.util.Locale.forLanguageTag(d.compiled.profile.locale));for(Object ref:LocalV2AdmittedEnvelope.search(d.compiled,d.owner.wall())){String id=LocalV2AdmittedEnvelope.checkedRef(d.compiled,ref,d.owner.wall());java.util.Map<String,Object> row=payload(d,id);String title=LocalV2PackageJson.text(row.get("title")).toLowerCase(java.util.Locale.forLanguageTag(d.compiled.profile.locale));boolean match=title.contains(query)||LocalV2PackageJson.text(row.get("text")).toLowerCase(java.util.Locale.forLanguageTag(d.compiled.profile.locale)).contains(query);for(Object term:LocalV2PackageJson.array(row.get("terms"),64))match|=LocalV2PackageJson.text(term).toLowerCase(java.util.Locale.forLanguageTag(d.compiled.profile.locale)).contains(query);if(match){if(matches.size()==64)break;matches.add(LocalV2AppOwner.map("reference",ref,"payload",row));}}d.fence();return matches;
            case "readCollection":return collection(d,request.collection,null,null);
            case "writeCollection":return collection(d,request.collection,request.expectedRevision,request.references);
            default:throw new PinKnownRefusal();
            }
        }
    }

}
