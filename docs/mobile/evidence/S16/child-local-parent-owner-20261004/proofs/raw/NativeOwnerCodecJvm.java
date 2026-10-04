package ru.probpera.literaryplanet;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
public final class NativeOwnerCodecJvm {
  static int assertions = 0, cases = 0;
  static final String VERSION="synthetic-codec-v1", POLICY="a".repeat(64);
  static final String CLOCK="{\"schemaVersion\":1,\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}";
  static void check(boolean value) { assertions++; if(!value) throw new AssertionError("assertion "+assertions); }
  static String hash(String value) throws Exception { byte[] h=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte x:h)b.append(String.format("%02x",x&255));return b.toString(); }
  static String registry(String locale,String tail) { return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":\"synthetic-child\",\"profiles\":[{\"id\":\"synthetic-child\",\"label\":\""+(locale.equals("ru")?"Синтетический читатель":"Synthetic Reader")+"\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\""+locale+"\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[\"violence\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false"+tail+"}]}"; }
  static String pin() { return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"revision\":1,\"credentialId\":\""+"e".repeat(64)+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\""+"f".repeat(64)+"\",\"hashHex\":\""+"d".repeat(64)+"\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":1010,\"pendingAttemptId\":null}}"; }
  static String record(long revision,String registry,String pin) throws Exception { return "{\"schemaVersion\":1,\"revision\":"+revision+",\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+POLICY+"\",\"registryChecksum\":\""+hash(registry)+"\",\"registry\":"+registry+",\"pin\":"+pin+",\"clock\":"+CLOCK+"}"; }
  static PlanetChildVault.ProtectedEnvelope decode(String value) throws Exception { return PlanetChildVault.ProtectedEnvelope.decode(value.getBytes(StandardCharsets.UTF_8),VERSION,POLICY,600000); }
  static void reject(String value) throws Exception { boolean refused=false;try(var parsed=decode(value)){}catch(PlanetChildVault.Unavailable e){refused=true;}check(refused); }
  static void caseDone(String label) { cases++;System.out.println("PASS "+label); }
  public static void main(String[] args) throws Exception {
    for(String locale:new String[]{"ru","en"}) {
      for(String tail:new String[]{"",",\"localeLocked\":false",",\"localeLocked\":true"}) {
        String value=record(7,registry(locale,tail),"null");byte[] supplied=value.getBytes(StandardCharsets.UTF_8);
        try(var parsed=PlanetChildVault.ProtectedEnvelope.decode(supplied,VERSION,POLICY,600000)) { check(hash(value).equals(parsed.checksum));check(parsed.isUnenrolled());Arrays.fill(supplied,(byte)0);check(Arrays.equals(value.getBytes(StandardCharsets.UTF_8),parsed.copyCanonicalBytes())); }
      }
      caseDone(locale+" canonical absent/false/true remain exact-owned bytes");
    }
    for(String tail:new String[]{",\"localeLocked\":null",",\"localeLocked\":1",",\"localeLocked\":\"true\"",",\"localeLocked\":{}",",\"localeLocked\":true,\"localeLocked\":false",",\"localeLocked\":true,\"future\":true"}) reject(record(7,registry("en",tail),"null"));
    caseDone("nonBoolean duplicate unknown tail denied");
    reject(record(7,registry("en",",\"localeLocked\":true").replace("\"narrationEnabled\":false,\"localeLocked\":true","\"localeLocked\":true,\"narrationEnabled\":false"),"null"));
    caseDone("noncanonical field order denied");
    for(String locale:new String[]{"ru","en"}) {
      String reg=registry(locale,",\"localeLocked\":true");
      try(var before=decode(record(7,reg,"null"));var after=decode(record(8,reg,pin()))) { PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,PlanetChildVault.PinLifecycleAction.enroll,1010);check(true); }
      boolean refused=false;try(var before=decode(record(7,reg,"null"));var after=decode(record(8,registry(locale,",\"localeLocked\":false"),pin()))) { try{PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,PlanetChildVault.PinLifecycleAction.enroll,1010);}catch(PlanetChildVault.Unavailable e){refused=true;} }check(refused);
      caseDone(locale+" PIN-only preserves exact locale lock; simultaneous change denied");
    }
    System.out.println("RESULT cases="+cases+" assertions="+assertions+" platform=pure-JVM codecOnly=true installedOS=false");
  }
}
