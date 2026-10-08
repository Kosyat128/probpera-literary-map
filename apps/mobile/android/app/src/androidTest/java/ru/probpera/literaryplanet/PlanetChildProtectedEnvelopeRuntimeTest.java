package ru.probpera.literaryplanet;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** New explicit synthetic structural vectors only. Does not construct a vault,
 * issue/check a checkpoint or parent permission, or prove installed PIN/input,
 * trusted clock, recovery, lifecycle, OS durability or child admission. NOT_RUN
 * until an independently recorded actual instrumentation execution exists. */
@RunWith(AndroidJUnit4.class)
public class PlanetChildProtectedEnvelopeRuntimeTest {
    private static final String VERSION = "synthetic-codec-v1", POLICY = repeat('a', 64);
    private static final String BOOT = "00000000-0000-4000-8000-000000000001";
    private static final String CLOCK = "{\"schemaVersion\":1,\"bootId\":\"" + BOOT + "\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}";
    private static String repeat(char c, int n) { char[] chars = new char[n]; Arrays.fill(chars, c); return new String(chars); }
    private static String sha(String value) throws Exception {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8), hash = null;
        try { hash = MessageDigest.getInstance("SHA-256").digest(bytes); StringBuilder out = new StringBuilder();
            for (byte b : hash) out.append("0123456789abcdef".charAt((b & 255) >>> 4)).append("0123456789abcdef".charAt(b & 15)); return out.toString();
        } finally { Arrays.fill(bytes, (byte) 0); if (hash != null) Arrays.fill(hash, (byte) 0); }
    }
    private static String registry(String labelToken, String locale) {
        return "{\"schemaVersion\":1,\"policyVersion\":\"" + VERSION + "\",\"activeProfileId\":\"synthetic-child\",\"profiles\":["
            + "{\"id\":\"synthetic-child\",\"label\":" + labelToken + ",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\"" + locale
            + "\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[\"violence\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false}]}";
    }
    private static String pin(long revision, char credential, char salt, long count, long blocked, long observed, String pending) {
        return "{\"schemaVersion\":1,\"policyVersion\":\"" + VERSION + "\",\"revision\":" + revision + ",\"credentialId\":\"" + repeat(credential, 64)
            + "\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\"" + repeat(salt, 64)
            + "\",\"hashHex\":\"" + repeat('d', 64) + "\"},\"attempts\":{\"count\":" + count + ",\"blockedUntilMs\":" + blocked
            + ",\"lastObservedMs\":" + observed + ",\"pendingAttemptId\":" + pending + "}}";
    }
    private static String envelope(long revision, String mode, String registry, String pin, String clock) throws Exception {
        return "{\"schemaVersion\":1,\"revision\":" + revision + ",\"mode\":\"" + mode + "\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""
            + POLICY + "\",\"registryChecksum\":\"" + sha(registry) + "\",\"registry\":" + registry + ",\"pin\":" + pin + ",\"clock\":" + clock + "}";
    }
    private static String seed(String locale) throws Exception { return envelope(7, "adult", registry(locale.equals("ru") ? "\"Синтетический читатель\"" : "\"Synthetic Reader\"", locale), "null", CLOCK); }
    private static String record() throws Exception { return envelope(7, "adult", registry("\"Synthetic Reader\"", "en"), pin(5, 'b', 'c', 2, 1050, 1000, "\"" + repeat('f', 64) + "\""), CLOCK); }
    private static PlanetChildVault.ProtectedEnvelope decode(String value) throws Exception {
        return PlanetChildVault.ProtectedEnvelope.decode(value.getBytes(StandardCharsets.UTF_8), VERSION, POLICY, 600000);
    }
    private static void rejected(String value) throws Exception {
        try (PlanetChildVault.ProtectedEnvelope ignored = decode(value)) { fail("Malformed synthetic structural vector accepted"); }
        catch (PlanetChildVault.Unavailable expected) { }
    }
    private static void transition(String old, String next, PlanetChildVault.PinLifecycleAction action, long logical, boolean expected) throws Exception {
        try (PlanetChildVault.ProtectedEnvelope before = decode(old); PlanetChildVault.ProtectedEnvelope after = decode(next)) {
            try { PlanetChildVault.ProtectedEnvelope.validateTransition(before, after, action, logical); assertTrue("Transition should have been refused", expected); }
            catch (PlanetChildVault.Unavailable refused) { assertFalse("Transition should have been valid", expected); }
        }
    }
    @Test public void canonicalRuEnSeedAndEnrolledBytesRemainOwned() throws Exception {
        for (String value : new String[] { seed("ru"), seed("en"), record() }) {
            byte[] supplied = value.getBytes(StandardCharsets.UTF_8);
            PlanetChildVault.ProtectedEnvelope parsed = PlanetChildVault.ProtectedEnvelope.decode(supplied, VERSION, POLICY, 600000);
            assertEquals(sha(value), parsed.checksum); assertEquals(value.contains("\"pin\":null"), parsed.isUnenrolled());
            Arrays.fill(supplied, (byte) 0); byte[] first = parsed.copyCanonicalBytes(); assertArrayEquals(value.getBytes(StandardCharsets.UTF_8), first);
            Arrays.fill(first, (byte) 0); assertArrayEquals(value.getBytes(StandardCharsets.UTF_8), parsed.copyCanonicalBytes()); parsed.close();
            try { parsed.copyCanonicalBytes(); fail("Disposed structural envelope supplied bytes"); } catch (PlanetChildVault.Unavailable expected) { }
        }
    }
    @Test public void exactEnrollReplaceRecoverPinOnlyTransitions() throws Exception {
        String registry = registry("\"Synthetic Reader\"", "en"), fresh = pin(1, 'e', 'f', 0, 0, 1010, "null");
        transition(seed("en"), envelope(8, "adult", registry, fresh, CLOCK), PlanetChildVault.PinLifecycleAction.enroll, 1010, true);
        transition(seed("ru"), envelope(8, "adult", registry("\"Синтетический читатель\"", "ru"), fresh, CLOCK), PlanetChildVault.PinLifecycleAction.enroll, 1010, true);
        String rotated = envelope(8, "adult", registry, pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK);
        transition(record(), rotated, PlanetChildVault.PinLifecycleAction.replace, 1010, true);
        transition(record(), rotated, PlanetChildVault.PinLifecycleAction.recover, 1010, true);
        transition(record(), rotated, PlanetChildVault.PinLifecycleAction.enroll, 1010, false);
        transition(seed("en"), envelope(8, "adult", registry, fresh, CLOCK), PlanetChildVault.PinLifecycleAction.replace, 1010, false);
    }
    @Test public void fullAndPinRevisionFreshCredentialSaltAndExactResetTimeRequired() throws Exception {
        String registry = registry("\"Synthetic Reader\"", "en");
        for (String next : new String[] {
            envelope(7, "adult", registry, pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK),
            envelope(9, "adult", registry, pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK),
            envelope(8, "adult", registry, pin(5, 'e', 'f', 0, 0, 1010, "null"), CLOCK),
            envelope(8, "adult", registry, pin(6, 'b', 'f', 0, 0, 1010, "null"), CLOCK),
            envelope(8, "adult", registry, pin(6, 'e', 'c', 0, 0, 1010, "null"), CLOCK),
            envelope(8, "adult", registry, pin(6, 'e', 'f', 0, 0, 1009, "null"), CLOCK),
            envelope(8, "adult", registry, pin(6, 'e', 'f', 1, 1050, 1010, "null"), CLOCK) })
            transition(record(), next, PlanetChildVault.PinLifecycleAction.replace, 1010, false);
        String maxOld = record().replace("\"revision\":7,", "\"revision\":9007199254740991,");
        transition(maxOld, envelope(8, "adult", registry, pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK), PlanetChildVault.PinLifecycleAction.replace, 1010, false);
    }
    @Test public void everyNonPinByteRemainsExactIncludingProfileModeAndClock() throws Exception {
        String registry = registry("\"Synthetic Reader\"", "en"), next = envelope(8, "adult", registry, pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK);
        for (String changed : new String[] { next.replace("\"mode\":\"adult\"", "\"mode\":\"child\""),
            next.replace("\"selectionRevision\":3", "\"selectionRevision\":4"), next.replace("\"profileRevision\":2", "\"profileRevision\":3"),
            envelope(8, "adult", registry("\"Changed Reader\"", "en"), pin(6, 'e', 'f', 0, 0, 1010, "null"), CLOCK),
            next.replace("\"uptimeAnchorMs\":100", "\"uptimeAnchorMs\":101") })
            transition(record(), changed, PlanetChildVault.PinLifecycleAction.replace, 1010, false);
    }
    @Test public void missingNullDuplicateExtraOrderWhitespaceAndNumericAlternativesRejected() throws Exception {
        String value = seed("en");
        for (String bad : new String[] { "", "null", value.replace("\"pin\":null,", ""), value.replace("\"pin\":null", "\"pin\":{}"),
            value.replace("\"mode\":\"adult\"", "\"mode\":\"child\""), " " + value, value + "\n",
            value.replace("\"revision\":7", "\"revision\":7.0"), value.replace("\"revision\":7", "\"revision\":7e0"),
            value.replace("\"revision\":7", "\"revision\":07"), value.replace("\"revision\":7", "\"revision\":-0"),
            value.replace("\"revision\":7", "\"revision\":9007199254740992"), value.replace("\"schemaVersion\":1,", "\"schemaVersion\":1,\"schemaVersion\":1,"),
            value.substring(0, value.length() - 1) + ",\"parentApproved\":true}", value.replace("\"revision\":7,\"mode\":\"adult\"", "\"mode\":\"adult\",\"revision\":7") }) rejected(bad);
        byte[] malformed = { (byte) 0xc3, 0x28 };
        try { PlanetChildVault.ProtectedEnvelope.decode(malformed, VERSION, POLICY, 600000); fail("Malformed UTF8 accepted"); }
        catch (java.nio.charset.CharacterCodingException expected) { }
        try { PlanetChildVault.ProtectedEnvelope.decode(null, VERSION, POLICY, 600000); fail("Missing bytes accepted"); }
        catch (PlanetChildVault.Unavailable expected) { }
    }
    @Test public void registryShaProfilesTopicsDatesAndAgeBandAreStrict() throws Exception {
        String registry = registry("\"Synthetic Reader\"", "en");
        rejected(seed("en").replace(sha(registry), repeat('f', 64)));
        for (String malformed : new String[] { registry.replace("\"ageBand\":\"9-11\"", "\"ageBand\":\"6-8\""),
            registry.replace("\"ageBand\":\"9-11\",", ""), registry.replace("2026-10-01", "2026-02-30"),
            registry.replace("T12:00:00", "T24:00:00"), registry.replace("\"violence\"", "\"violence\",\"violence\""),
            registry.replace("\"readingLevel\":null", "\"readingLevel\":\"invented\""), registry.replace("\"activeProfileId\":\"synthetic-child\"", "\"activeProfileId\":\"missing\""),
            registry.replace("\"label\":\"Synthetic Reader\"", "\"label\":\" Synthetic Reader\""), registry.replace("\"label\":\"Synthetic Reader\"", "\"label\":\"Synthetic Reader\\t\""),
            registry.replace("\"exactAge\":9", "\"exactAge\":2") }) rejected(envelope(7, "adult", malformed, "null", CLOCK));
        try (PlanetChildVault.ProtectedEnvelope accepted = decode(envelope(7, "adult", registry.replace("2026-10-01", "0000-02-29"), "null", CLOCK))) { assertTrue(accepted.isUnenrolled()); }
    }
    @Test public void canonicalJsonStringEscapesSurrogatesAndLiteralUnicodeMatchTs() throws Exception {
        String[] valid = { "\"Читатель😀\"", "\"Reader\\\"\\\\\"", "\"Reader\\ud800\"", "\"Reader\\udfff\"", "\"A\u2028B\"" };
        for (String label : valid) try (PlanetChildVault.ProtectedEnvelope ignored = decode(envelope(7, "adult", registry(label, "ru"), "null", CLOCK))) { }
        for (String label : new String[] { "\"Reader\\u0061\"", "\"Reader\\/\"", "\"Reader\\uD800\"", "\"Reader\\ud83d\\ude00\"", "\"Reader\\u2028B\"" })
            rejected(envelope(7, "adult", registry(label, "ru"), "null", CLOCK));
    }
    @Test public void registryProfileTopicAndUtf16LabelBoundsRemainFinite() throws Exception {
        String single = registry("\"Synthetic Reader\"", "en"); int first = single.indexOf("[{"), last = single.lastIndexOf("]}");
        String profile = single.substring(first + 1, last), header = single.substring(0, first + 1);
        StringBuilder profiles = new StringBuilder();
        for (int i = 0; i < 5; i++) { if (i > 0) profiles.append(','); profiles.append(profile.replace("\"id\":\"synthetic-child\"", "\"id\":\"child-" + i + "\""));
            String registry = header.replace("\"activeProfileId\":\"synthetic-child\"", "\"activeProfileId\":\"child-0\"") + profiles + "]}";
            if (i < 4) try (PlanetChildVault.ProtectedEnvelope ignored = decode(envelope(7, "adult", registry, "null", CLOCK))) { }
            else rejected(envelope(7, "adult", registry, "null", CLOCK)); }
        rejected(envelope(7, "adult", header + profile + "," + profile + "]}", "null", CLOCK));
        StringBuilder topics = new StringBuilder("[");
        for (int i = 0; i < 65; i++) { if (i > 0) topics.append(','); topics.append('"').append("topic-").append(i).append('"'); }
        topics.append(']'); rejected(envelope(7, "adult", single.replace("[\"violence\"]", topics.toString()), "null", CLOCK));
        try (PlanetChildVault.ProtectedEnvelope ignored = decode(envelope(7, "adult", registry("\"" + repeat('r', 80) + "\"", "en"), "null", CLOCK))) { }
        rejected(envelope(7, "adult", registry("\"" + repeat('r', 81) + "\"", "en"), "null", CLOCK));
        StringBuilder emoji = new StringBuilder(); for (int i = 0; i < 40; i++) emoji.append("😀");
        try (PlanetChildVault.ProtectedEnvelope ignored = decode(envelope(7, "adult", registry("\"" + emoji + "\"", "en"), "null", CLOCK))) { }
        rejected(envelope(7, "adult", registry("\"" + emoji + "😀\"", "en"), "null", CLOCK));
        try { PlanetChildVault.ProtectedEnvelope.decode(new byte[131073], VERSION, POLICY, 600000); fail("Oversize input accepted"); }
        catch (PlanetChildVault.Unavailable expected) { }
    }
    @Test public void pinFloorJournalAndClockAnchorBoundsRejectMalformedRecords() throws Exception {
        String value = record();
        for (String bad : new String[] { value.replace("600000", "599999"), value.replace("600000", "600001"),
            value.replace("PBKDF2-HMAC-SHA256", "SHA256"), value.replace("\"lastObservedMs\":1000", "\"lastObservedMs\":999"),
            value.replace("\"blockedUntilMs\":1050", "\"blockedUntilMs\":999"), value.replace("\"count\":2", "\"count\":0"),
            value.replace(BOOT, "invalid-boot"), value.replace("\"uptimeAnchorMs\":100", "\"uptimeAnchorMs\":9007199254740992"),
            value.replace("\"epochAnchor\":null", "\"epochAnchor\":{\"epochAnchorMs\":100,\"validUntilEpochMs\":100,\"proofChecksum\":\"" + POLICY + "\"}"),
            value.replace("\"epochAnchor\":null", "\"epochAnchor\":{\"epochAnchorMs\":8640000000000001,\"validUntilEpochMs\":8640000000000002,\"proofChecksum\":\"" + POLICY + "\"}") }) rejected(bad);
    }
    @Test public void localePolicyParentDraftPreservesPinSiblingLegacyAndOptionalOrder() throws Exception {
        for(String scenario:new String[]{"add","narrow","parent-allowed","legacy","policy-only-lock","policy-first-unlock"})assertTrue(PlanetChildVault.fixtureAppLocalePolicy(scenario));
    }
    @Test public void localePolicyDraftAndSummaryRejectMalformedOrDisallowedEdits() throws Exception {
        for(String scenario:new String[]{"parent-denied","sibling","boolean-version","string-version","empty","duplicate","excluded-current","extra","duplicate-policy-fields"})assertTrue(PlanetChildVault.fixtureAppLocalePolicy(scenario));
    }
    @Test public void localePolicySummaryExportAndConfirmationPreservePlainLanguages() throws Exception {
        assertTrue(PlanetChildVault.fixtureAppLocalePolicy("summary-export"));
    }

    @Test public void localeLockParentDraftPreservesPinSiblingAndOtherProfileFields() throws Exception {
        for(String scenario:new String[]{"lock","unlock","legacy","parent-language"})assertTrue(PlanetChildVault.fixtureAppLocaleLock(scenario));
    }
    @Test public void localeLockDraftRejectsNumericStringNullAndSiblingTargets() throws Exception {
        for(String scenario:new String[]{"number","string","null","sibling"})assertTrue(PlanetChildVault.fixtureAppLocaleLock(scenario));
    }
    @Test public void localeLockSummaryKeepsLegacyUnknownAndRejectsCorruptTypes() throws Exception {
        assertTrue(PlanetChildVault.fixtureAppLocaleLock("summary"));
    }
}
