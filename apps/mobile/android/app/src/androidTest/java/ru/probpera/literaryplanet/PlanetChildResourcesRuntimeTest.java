package ru.probpera.literaryplanet;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.util.*;

/** Production parser/transport boundary mechanics only. Synthetic parser data
 * cannot mint a live Vault claim; no OS/UI/TLS-network/review/rights acceptance. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildResourcesRuntimeTest {
    @Before public void ownFixture(){android.os.Bundle b=InstrumentationRegistry.getArguments();assertEquals("local-v2-resources",b.getString("literaryChildResourcesPhase"));assertTrue(b.getString("literaryRunId","").matches("[a-f0-9]{32}"));}
    private interface Attempt{void run()throws Exception;}
    private static void denied(Attempt body)throws Exception {try{body.run();fail("Expected native closed refusal");}catch(InvocationTargetException error){assertNotNull(error.getCause());assertTrue(error.getCause() instanceof PlanetChildVault.Unavailable);}catch(PlanetChildVault.Unavailable expected){}}
    private static Map<String,Object> map(Object... pairs){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)out.put((String)pairs[i],pairs[i+1]);return out;}
    private static byte[] json(Map<String,Object> value){return new org.json.JSONObject(value).toString().getBytes(StandardCharsets.UTF_8);}
    private static String sha(byte[] bytes)throws Exception {byte[] digest=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder s=new StringBuilder();for(byte b:digest)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}
    private static Map<String,Object> empty(){return map("schemaVersion",2L,"kind","literary-planet-child-native-resource-catalog-v2","platform",null,"resourcePinSourceChecksum","a".repeat(64),"origins",Collections.emptyList(),"resources",Collections.emptyList());}
    private static Map<String,Object> artifact(Map<String,Object> catalog)throws Exception {
        String pin=(String)catalog.get("resourcePinSourceChecksum"),sum=sha(json(catalog));return map("kind","literary-planet-bundled-native-preparation","platform","android","channel",catalog.get("platform")==null?"dev":"googlePlay","releaseReady",false,"productionActionsAuthorized",false,
          "sourceInputs",map("sha256","b".repeat(64),"files",Arrays.asList(map("path","scripts/mobile/native-child-resource-assets.mjs","sha256","c".repeat(64)),map("path","src/child/childNativeResource.ts","sha256","d".repeat(64)),map("path","src/child/childNativeResourceReleasePins.json","sha256",pin))),
          "inventory",Collections.singletonList(map("path",PlanetChildResources.CATALOG,"bytes",(long)json(catalog).length,"sha256",sum)),
          "childNativeResourceAssets",map("pinSource",map("path","src/child/childNativeResourceReleasePins.json","sha256",pin),"outputs",Collections.singletonList(map("output",PlanetChildResources.CATALOG,"source","src/child/childNativeResourceReleasePins.json","sourceSha256",pin,"transformation","fixed-native-resource-pin-projection-v2","outputSha256",sum))));
    }
    private static Object catalog(Map<String,Object> c,Map<String,Object> a)throws Exception {Class<?> type=Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2ResourceCatalog");Constructor<?> make=type.getDeclaredConstructor(byte[].class,byte[].class,String.class);make.setAccessible(true);return make.newInstance(json(c),json(a),"android-google");}
    private static Map<String,String> headers(String mime,int count){Map<String,String> h=new HashMap<>();h.put("content-type",mime);h.put("content-length",Integer.toString(count));return h;}
    private static Map<String,Object> binding(){String sum="e".repeat(64);return map("id","parser-only","packageId","parser-package","packageVersion",1L,"packageChecksum","1".repeat(64),"policyVersion","parser-policy","policyChecksum","2".repeat(64),"manifestChecksum","3".repeat(64),"reviewChecksum","4".repeat(64),"assetId","parser-asset","assetChecksum",sum,"assetBytes",1L,"mime","image/png","originId","parser-origin","path","/objects/"+sum+".png","validFromEpochMs",1L,"validUntilEpochMs",2L);}
    @Test public void localV2ResourcesEmptyCatalogRequiresExactProducerSourceAndOutput()throws Exception {
        Map<String,Object> c=empty(),a=artifact(c);assertNotNull(catalog(c,a));a.put("childNativeResourceAssets",map("pinSource",map("path","src/child/childNativeResourceReleasePins.json","sha256","f".repeat(64)),"outputs",Collections.emptyList()));denied(()->catalog(c,a));
    }
    @SuppressWarnings("unchecked") @Test public void localV2ResourcesCatalogRejectsMissingInputsAndOrphanInventory()throws Exception {
        Map<String,Object> c=empty(),a=artifact(c);((Map<String,Object>)a.get("sourceInputs")).put("files",Collections.emptyList());denied(()->catalog(c,a));Map<String,Object> orphan=artifact(c);List<Object> rows=new ArrayList<>((List<?>)orphan.get("inventory"));rows.add(map("path","child-native/resources/orphan.json","bytes",1L,"sha256","f".repeat(64)));orphan.put("inventory",rows);denied(()->catalog(c,orphan));
    }
    @Test public void localV2ResourcesCatalogRejectsUnknownFieldsAndAmbiguousBindings()throws Exception {
        Map<String,Object> c=empty();c.put("nativePermission",true);denied(()->catalog(c,artifact(c)));c.remove("nativePermission");c.put("platform","android-google");c.put("origins",Collections.singletonList(map("id","parser-origin","origin","https://assets.example.com","tlsPublicKeyX963Checksums",Collections.singletonList("9".repeat(64)))));c.put("resources",Arrays.asList(binding(),binding()));denied(()->catalog(c,artifact(c)));c.put("resources",Collections.singletonList(binding()));assertNotNull(catalog(c,artifact(c)));c.put("platform",null);denied(()->catalog(c,artifact(c)));
    }
    @Test public void localV2ResourcesCanonicalOriginRejectsCallerAuthorityAndTraversal()throws Exception {
        assertEquals("https://assets.example.com",PlanetChildResources.canonicalOrigin("https://assets.example.com"));for(String raw:Arrays.asList("http://assets.example.com","https://ASSETS.example.com","https://assets.example.com/","https://assets.example.com:443","https://user@assets.example.com","https://127.0.0.1","https://assets.local","https://assets.example.com?child=1","https://assets.example.com#child","https://assets..example.com"))denied(()->PlanetChildResources.canonicalOrigin(raw));
    }
    @Test public void localV2ResourcesCanonicalPathBindsExactHashAndMime()throws Exception {
        String h="a".repeat(64);assertEquals("/objects/"+h+".png",PlanetChildResources.canonicalPath(h,"image/png"));assertEquals("/objects/"+h+".wav",PlanetChildResources.canonicalPath(h,"audio/wav"));denied(()->PlanetChildResources.canonicalPath("../"+h,"image/png"));denied(()->PlanetChildResources.canonicalPath(h,"image/svg+xml"));denied(()->PlanetChildResources.canonicalPath(h.toUpperCase(Locale.ROOT),"image/png"));
    }
    @Test public void localV2ResourcesResponseRequiresExactStatusMimeAndLength()throws Exception {
        PlanetChildResources.responseHeaders("HTTP/1.1 200 OK",headers("image/png",3),"image/png",3);for(String status:Arrays.asList("HTTP/1.1 302 Found","HTTP/1.1 206 Partial Content","HTTP/2 200"))denied(()->PlanetChildResources.responseHeaders(status,headers("image/png",3),"image/png",3));Map<String,String> h=headers("image/png",3);h.put("content-type","image/png; charset=utf-8");denied(()->PlanetChildResources.responseHeaders("HTTP/1.1 200 OK",h,"image/png",3));h.put("content-type","image/png");h.put("content-length","03");denied(()->PlanetChildResources.responseHeaders("HTTP/1.1 200 OK",h,"image/png",3));h.put("content-length","3");h.put("transfer-encoding","chunked");denied(()->PlanetChildResources.responseHeaders("HTTP/1.1 200 OK",h,"image/png",3));
    }
    @Test public void localV2ResourcesBoundedBodyUsesActualBytesAndHash()throws Exception {
        byte[] original={1,2,3};byte[] result=PlanetChildResources.boundedBody(new ByteArrayInputStream(original),3,sha(original));assertArrayEquals(original,result);assertNotSame(original,result);denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(new byte[]{1,2}),3,sha(original)));denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(new byte[]{1,2,3,4}),3,sha(original)));denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(original),3,"0".repeat(64)));Arrays.fill(result,(byte)0);
    }
    @Test public void localV2ResourcesBoundedBodyRejectsZeroProgressAndOversizedInput()throws Exception {
        InputStream stalled=new InputStream(){public int read(){return -1;}public int read(byte[] b,int at,int length){return 0;}};denied(()->PlanetChildResources.boundedBody(stalled,1,"a".repeat(64)));denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(new byte[0]),33554433,"a".repeat(64)));denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(new byte[0]),0,"a".repeat(64)));
    }
    @Test public void localV2ResourcesBodyRefusalWipesActualOwnedBuffer()throws Exception {
        for(int mode=0;mode<3;mode++){
            final int failureMode=mode;final byte[][] captured={null};
            InputStream actual=new InputStream(){
                int step;
                public int read(){return failureMode==1?7:-1;}
                public int read(byte[] bytes,int at,int length)throws IOException {
                    captured[0]=bytes;if(step++>0)throw new IOException("fixture read failure");
                    bytes[at]=1;if(failureMode==0)return 1;
                    bytes[at+1]=2;bytes[at+2]=3;return 3;
                }
            };
            try{PlanetChildResources.boundedBody(actual,3,failureMode==2?"0".repeat(64):sha(new byte[]{1,2,3}));fail("Expected refused body");}
            catch(IOException|PlanetChildVault.Unavailable expected){}
            assertNotNull(captured[0]);assertArrayEquals(new byte[3],captured[0]);
        }
    }
    @Test public void localV2ResourcesTLSKeyHashRequiresActualP256PublicKey()throws Exception {
        KeyPairGenerator ec=KeyPairGenerator.getInstance("EC");ec.initialize(new ECGenParameterSpec("secp256r1"));PublicKey key=ec.generateKeyPair().getPublic();String hash=PlanetChildResources.tlsKeyChecksum(key);assertTrue(hash.matches("[a-f0-9]{64}"));assertEquals(hash,PlanetChildResources.tlsKeyChecksum(key));ec.initialize(new ECGenParameterSpec("secp384r1"));PublicKey other=ec.generateKeyPair().getPublic();denied(()->PlanetChildResources.tlsKeyChecksum(other));KeyPairGenerator rsa=KeyPairGenerator.getInstance("RSA");rsa.initialize(2048);PublicKey wrong=rsa.generateKeyPair().getPublic();denied(()->PlanetChildResources.tlsKeyChecksum(wrong));
    }
    @Test public void localV2ResourcesOriginalDeadlineNeverRenewsSourceLifetime()throws Exception {
        assertEquals(50L,PlanetChildResources.originalRemaining(200,100,1050,1000));assertEquals(10L,PlanetChildResources.originalRemaining(200,190,1050,1040));denied(()->PlanetChildResources.originalRemaining(200,200,1050,1000));denied(()->PlanetChildResources.originalRemaining(200,100,1050,1050));denied(()->PlanetChildResources.originalRemaining(70000,0,80000,0));
    }
    @Test public void localV2ResourcesDNSGateRejectsLocalAndReservedAddresses()throws Exception {
        for(byte[] ip:Arrays.asList(new byte[]{127,0,0,1},new byte[]{10,1,2,3},new byte[]{100,64,0,1},new byte[]{(byte)192,(byte)168,0,1},new byte[]{(byte)198,51,100,1},new byte[16]))assertFalse(PlanetChildResources.publicAddress(InetAddress.getByAddress(ip)));assertTrue(PlanetChildResources.publicAddress(InetAddress.getByAddress(new byte[]{8,8,8,8})));
    }
    @Test public void localV2ResourcesPrivateClaimAndWireCannotMintNativeAuthority()throws Exception {
        for(Constructor<?> c:PlanetChildVault.LocalV2ResourceClaim.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(c.getModifiers()));for(Constructor<?> c:PlanetChildResources.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(c.getModifiers()));denied(()->PlanetChildResources.original(null));Map<String,Object> r=map("version",2L,"requestId","1".repeat(32),"contextToken","2".repeat(32),"owner",map("kind","writer","id","fixture","contentChecksum","a".repeat(64)),"url","https://assets.example.com/objects/a.png");denied(()->PlanetChildDataTransport.decodeV2("listMedia",r));for(String method:Arrays.asList("listMedia","presentMedia","releaseMedia"))assertNotNull(PlanetChildPlugin.class.getDeclaredMethod(method,com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));assertNotNull(PlanetChildResources.class.getDeclaredMethod("closeJoined"));assertNotNull(PlanetChildResources.class.getDeclaredMethod("knownClosed"));
    }
}