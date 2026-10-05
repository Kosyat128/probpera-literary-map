package ru.probpera.literaryplanet;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.*;
import java.util.*;
import java.security.MessageDigest;
import java.io.ByteArrayOutputStream;

/** Software/compiler/codec/wire mechanics only; no saved Vault, media permit,
 * human review, hardware lifecycle or release acceptance is manufactured. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildMediaRuntimeTest {
    @Before public void ownFixture(){android.os.Bundle b=InstrumentationRegistry.getArguments();assertEquals("local-v2-media",b.getString("literaryChildMediaPhase"));assertTrue(b.getString("literaryRunId","").matches("[a-f0-9]{32}"));}
    private interface Attempt{void run()throws Exception;}
    private static void denied(Attempt work)throws Exception {try{work.run();fail("Expected closed refusal");}catch(InvocationTargetException e){assertNotNull(e.getCause());}catch(PlanetChildVault.Unavailable|PlanetChildDataStore.Unavailable expected){}}
    private static Map<String,Object> map(Object... pairs){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)out.put((String)pairs[i],pairs[i+1]);return out;}
    private static String sha(byte[] b)throws Exception {byte[] h=MessageDigest.getInstance("SHA-256").digest(b);StringBuilder s=new StringBuilder();for(byte x:h)s.append(String.format(Locale.ROOT,"%02x",x&255));return s.toString();}
    private static byte[] json(Map<String,Object> v){return new org.json.JSONObject(v).toString().getBytes(StandardCharsets.UTF_8);}
    private static Map<String,Object> owner(){return map("kind","writer","id","reviewed","contentChecksum","a".repeat(64));}
    private static Map<String,Object> base(){return map("version",2L,"requestId","1".repeat(32),"contextToken","2".repeat(32));}
    private static Map<String,Object> layout(){return map("x",0L,"y",8L,"width",100L,"height",120L,"viewportWidth",400L,"viewportHeight",800L);}
    private static byte[] chunk(String type,byte[] data)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(ByteBuffer.allocate(4).putInt(data.length).array());byte[] kind=type.getBytes(StandardCharsets.US_ASCII);out.write(kind);out.write(data);java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(kind);crc.update(data);out.write(ByteBuffer.allocate(4).putInt((int)crc.getValue()).array());return out.toByteArray();}
    private static byte[] png(int w,int h,boolean animated)throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();out.write(new byte[]{(byte)137,80,78,71,13,10,26,10});ByteBuffer header=ByteBuffer.allocate(13).putInt(w).putInt(h);header.put((byte)8).put((byte)6).put((byte)0).put((byte)0).put((byte)0);out.write(chunk("IHDR",header.array()));if(animated)out.write(chunk("acTL",new byte[8]));out.write(chunk("IDAT",new byte[]{1}));out.write(chunk("IEND",new byte[0]));return out.toByteArray();}
    private static byte[] wav(int seconds,int channels,int bits){int rate=8000,n=seconds*rate*channels*bits/8;ByteBuffer b=ByteBuffer.allocate(44+n).order(ByteOrder.LITTLE_ENDIAN);b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36+n).put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short)1).putShort((short)channels).putInt(rate).putInt(rate*channels*bits/8).putShort((short)(channels*bits/8)).putShort((short)bits).put("data".getBytes(StandardCharsets.US_ASCII)).putInt(n);return b.array();}
    private static byte[] webp(boolean animated){ByteBuffer b=ByteBuffer.allocate(30).order(ByteOrder.LITTLE_ENDIAN);b.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(22).put("WEBPVP8X".getBytes(StandardCharsets.US_ASCII)).putInt(10).put((byte)(animated?2:0)).put(new byte[9]);return b.array();}
    private static Class<?> catalogClass()throws Exception{return Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2MediaCatalog");}
    private static Object catalog(Map<String,Object> c,Map<String,Object> a)throws Exception {Constructor<?> ctor=catalogClass().getDeclaredConstructor(byte[].class,byte[].class,String.class);ctor.setAccessible(true);return ctor.newInstance(json(c),json(a),"android-google");}
    @SuppressWarnings("unchecked") private static Map<String,Object>[] emptyCatalog()throws Exception {
        String pin="a".repeat(64);
        Map<String,Object> c=map("schemaVersion",2L,"kind","literary-planet-child-native-media-catalog-v2","platform",null,"mediaPinSourceChecksum",pin,"reviewKeys",Collections.emptyList(),"manifests",Collections.emptyList());
        String sum=sha(json(c));Map<String,Object> a=map("kind","literary-planet-bundled-native-preparation","platform","android","channel","dev","releaseReady",false,"productionActionsAuthorized",false,
          "sourceInputs",map("sha256","c".repeat(64),"files",Arrays.asList(map("path","scripts/mobile/native-child-media-assets.mjs","sha256","b".repeat(64)),map("path","src/child/childNativeMediaReleasePins.json","sha256",pin))),
          "inventory",Collections.singletonList(map("path","child-native/media/catalog-v2.json","bytes",(long)json(c).length,"sha256",sum)),
          "childNativeMediaAssets",map("pinSource",map("path","src/child/childNativeMediaReleasePins.json","sha256",pin),"outputs",Collections.singletonList(map("output","child-native/media/catalog-v2.json","source","src/child/childNativeMediaReleasePins.json","sourceSha256",pin,"transformation","fixed-native-media-pin-projection-v2","outputSha256",sum))));
        return new Map[]{c,a};
    }
    @Test public void localV2MediaWireBindsExactOwnerAndRejectsCallerProofs()throws Exception {
        Map<String,Object> r=base();r.put("owner",owner());assertEquals("reviewed",PlanetChildDataTransport.decodeV2("listMedia",r).owner.get("id"));
        r.put("verified",true);denied(()->PlanetChildDataTransport.decodeV2("listMedia",r));r.remove("verified");r.put("owner",map("kind","image","id","reviewed","contentChecksum","a".repeat(64)));denied(()->PlanetChildDataTransport.decodeV2("listMedia",r));r.put("owner",owner());r.put("url","https://example.invalid/a.png");denied(()->PlanetChildDataTransport.decodeV2("listMedia",r));
    }
    @Test public void localV2MediaLayoutRejectsOverflowFractionsAndNegativeZero()throws Exception {
        Map<String,Object> r=base();r.put("owner",owner());r.put("assetId","portrait");r.put("layout",layout());assertNotNull(PlanetChildDataTransport.decodeV2("presentMedia",r).layout);
        for(Object bad:Arrays.asList(-0.0,0.5,8193L)){Map<String,Object> g=layout();g.put("x",bad);r.put("layout",g);denied(()->PlanetChildDataTransport.decodeV2("presentMedia",r));}Map<String,Object> g=layout();g.put("width",401L);r.put("layout",g);denied(()->PlanetChildDataTransport.decodeV2("presentMedia",r));
    }
    @Test public void localV2MediaNullReleaseIsRevocationOnlyAndExact()throws Exception {
        Map<String,Object> r=base();r.put("presentationToken",null);assertNull(PlanetChildDataTransport.decodeV2("releaseMedia",r).presentationToken);r.put("presentationToken","3".repeat(32));assertEquals("3".repeat(32),PlanetChildDataTransport.decodeV2("releaseMedia",r).presentationToken);r.put("cleared",true);denied(()->PlanetChildDataTransport.decodeV2("releaseMedia",r));
    }
    @Test public void localV2MediaActualPluginMethodsAndPrivatePermitAreRegistered()throws Exception {
        for(String name:Arrays.asList("listMedia","presentMedia","releaseMedia"))assertNotNull(PlanetChildPlugin.class.getDeclaredMethod(name,com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));
        for(Constructor<?> c:PlanetChildVault.LocalV2MediaPermit.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(c.getModifiers()));denied(()->PlanetChildMedia.Owner.decode(null,new byte[]{1}));
    }
    @SuppressWarnings("unchecked") @Test public void localV2MediaEmptyCatalogRequiresExactSourceAndOutputClosure()throws Exception {
        Map<String,Object>[] f=emptyCatalog();Object c=catalog(f[0],f[1]);Method complete=catalogClass().getDeclaredMethod("complete");complete.setAccessible(true);complete.invoke(c);
        ((Map<String,Object>)f[1].get("sourceInputs")).put("files",Collections.emptyList());denied(()->catalog(f[0],f[1]));
    }
    @Test public void localV2MediaCatalogDeniesOrphansAndTextReviewKeyNamespace()throws Exception {
        Map<String,Object>[] f=emptyCatalog();List<Object> inventory=new ArrayList<>((List<?>)f[1].get("inventory"));inventory.add(map("path","child-native/media/assets/"+"d".repeat(64)+".png","bytes",1L,"sha256","d".repeat(64)));f[1].put("inventory",inventory);
        Object c=catalog(f[0],f[1]);Method complete=catalogClass().getDeclaredMethod("complete");complete.setAccessible(true);denied(()->complete.invoke(c));
        final Map<String,Object>[] bad=emptyCatalog();bad[0].put("reviewKeys",Collections.singletonList(map("keyId","child-release-review-text","reviewerId","fixture","publicKeyX963Hex","04"+"1".repeat(128))));denied(()->catalog(bad[0],bad[1]));
    }
    @Test public void localV2MediaStaticPNGRejectsAnimationCRCAndOversizedPixels()throws Exception {
        PlanetChildMedia.Header h=PlanetChildMedia.preflight(png(10,20,false),"image/png");assertEquals(10,h.width);assertEquals(20,h.height);denied(()->PlanetChildMedia.preflight(png(10,20,true),"image/png"));denied(()->PlanetChildMedia.preflight(png(2049,1,false),"image/png"));
        byte[] bad=png(10,20,false);bad[29]^=1;denied(()->PlanetChildMedia.preflight(bad,"image/png"));byte[] tail=Arrays.copyOf(png(10,20,false),png(10,20,false).length+1);denied(()->PlanetChildMedia.preflight(tail,"image/png"));
    }
    @Test public void localV2MediaJPEGAndWebPRejectHiddenFramesAndContainerTails()throws Exception {
        denied(()->PlanetChildMedia.preflight(new byte[]{(byte)255,(byte)216,(byte)255,(byte)217},"image/jpeg"));denied(()->PlanetChildMedia.preflight(webp(true),"image/webp"));denied(()->PlanetChildMedia.preflight(webp(false),"image/webp"));byte[] tail=Arrays.copyOf(webp(false),31);denied(()->PlanetChildMedia.preflight(tail,"image/webp"));
    }
    @Test public void localV2MediaPCMRequiresBoundedDurationAlignmentAndActualContainer()throws Exception {
        PlanetChildMedia.Header h=PlanetChildMedia.preflight(wav(1,2,16),"audio/wav");assertTrue(h.audio());assertEquals(2,h.channels);assertEquals(8000,h.rate);assertEquals(32000,h.length);
        denied(()->PlanetChildMedia.preflight(wav(61,1,8),"audio/wav"));byte[] bad=wav(1,2,16);bad[32]=1;denied(()->PlanetChildMedia.preflight(bad,"audio/wav"));byte[] tail=Arrays.copyOf(wav(1,1,8),8045);denied(()->PlanetChildMedia.preflight(tail,"audio/wav"));
    }
    @Test public void localV2MediaUnsupportedFormatsAndUnownedDecodeStayClosed()throws Exception {
        for(String mime:Arrays.asList("image/svg+xml","video/mp4","model/gltf-binary","audio/mpeg"))denied(()->PlanetChildMedia.preflight(new byte[]{1,2,3},mime));denied(()->PlanetChildMedia.Owner.decode(null,png(1,1,false)));
    }
}
