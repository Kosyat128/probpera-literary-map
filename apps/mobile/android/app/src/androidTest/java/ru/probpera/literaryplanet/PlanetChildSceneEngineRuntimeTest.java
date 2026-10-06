package ru.probpera.literaryplanet;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.lang.reflect.*;
import java.util.*;
import java.nio.charset.StandardCharsets;

/** Authored, NOT_RUN. Pure strict-schema, checksum and actual raster-decoder
 * fixtures create no original scene, profile, rights, lease or output permit.
 * Passing these tests cannot stand in for the native lifecycle/OSCAS suite. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildSceneEngineRuntimeTest {
    interface Attempt { void run() throws Exception; }
    static void denied(Attempt body)throws Exception { try { body.run();fail("Expected native constraint denial"); } catch(InvocationTargetException error) { assertNotNull(error.getCause()); } }
    static Map<String,Object> map(Object... values) { Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out; }
    static Object call(String name,Class<?>[] types,Object... values)throws Exception { Class<?> engine=Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2SceneEngine");Method method=engine.getDeclaredMethod(name,types);method.setAccessible(true);return method.invoke(null,values); }
    static Map<String,Object> engine() {
        String hash="a".repeat(64);List<Object> items=new ArrayList<>(),textures=new ArrayList<>(),tiers=new ArrayList<>();String[] slots={"skin","stand","background"};
        Map<String,Object> partners=map("skin",Arrays.asList("fixture-skin"),"stand",Arrays.asList("fixture-stand"),"background",Arrays.asList("fixture-background"));
        for(int i=0;i<3;i++){String slot=slots[i];items.add(map("slotId",slot,"assetId","fixture-"+slot,"contentChecksum",hash,"editions",Arrays.asList("fixture-edition"),"partners",new LinkedHashMap<>(partners),"accessoryIds",Collections.emptyList(),"booky","preserve-existing","explore",false,"childSafe",true,"minAge",3L,"maxAge",17L,"platforms",Arrays.asList("android"),"tiers",Arrays.asList("high","balanced","economy"),"minAppVersion",1L,"minContentVersion",1L,"rightsBinding","current-native-scene"));textures.add(map("slotId",slot,"assetId","fixture-"+slot,"width",i==0?2L:1L,"height",1L));}
        for(String tier:Arrays.asList("high","balanced","economy"))tiers.add(map("tier",tier,"classification","economy".equals(tier)?"3d-lite":"geometry","maxDecodedBytes",4096L,"maxResidentBytes",131072L,"maxTriangles",1L,"maxEncodedCacheBytes",0L));
        return map("schemaVersion",1L,"profile","canonical-scene-v1","sceneId","fixture-model.v1","modelPackageId","fixture-model","modelPackageVersion",1L,"items",items,"textures",textures,"tiers",tiers,
            "anchors",map("globe","canonical-origin","booky","existing-screen-avatar","camera","preserve-live","stand","canonical-below-globe","bookyPaddingPx",12L),
            "lighting",map("ambientRgb",Arrays.asList(255L,255L,255L),"ambientMilli",500L,"keyRgb",Arrays.asList(255L,255L,255L),"keyMilli",1000L,"exposurePermille",1000L),
            "ambience",map("animation","none","amplitudePermille",0L,"periodMs",4000L,"audio","silent"),"transition",map("durationMs",300L,"timeoutMs",800L,"reducedMotion","instant"),"fallback",map("staticAllowed",false,"preserveSkin",true,"preserveBooky",true));
    }
    @SuppressWarnings("unchecked") static Map<String,Object> nested(Map<String,Object> root,String key) { return (Map<String,Object>)root.get(key); }
    @SuppressWarnings("unchecked") static Map<String,Object> row(Map<String,Object> root,String key,int i) { return (Map<String,Object>)((List<Object>)root.get(key)).get(i); }
    static Map<String,Object> root(Map<String,Object> engine) { String hash="a".repeat(64);return map("schemaVersion",4L,"sceneId","fixture-model.v1","modelPackage",map("packageId","fixture-model","packageVersion",1L),"engineComposition",engine,
        "skin",map("assetId","fixture-skin","entity",map("contentChecksum",hash)),"stand",map("asset",map("assetId","fixture-stand","entity",map("contentChecksum",hash))),"background",map("asset",map("assetId","fixture-background","entity",map("contentChecksum",hash)))); }
    static String checksum(Map<String,Object> engine)throws Exception { Class<?> json=Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2PackageJson");Method bytes=json.getDeclaredMethod("bytes",Object.class,boolean.class);bytes.setAccessible(true);byte[] raw=(byte[])bytes.invoke(null,engine,true);try{byte[] digest=java.security.MessageDigest.getInstance("SHA-256").digest(raw);StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}finally{Arrays.fill(raw,(byte)0);} }
    static void check(Map<String,Object> root,Map<String,Object> review,long age,long version,String platform)throws Exception { call("check",new Class<?>[]{Map.class,Map.class,long.class,long.class,String.class},root,review,age,version,platform); }
    @Test public void strictIntegerDecoderDeniesUnknownFieldsAndProtectedPolicyChanges()throws Exception {
        Map<String,Object> e=engine();assertNotNull(call("decode",new Class<?>[]{Object.class},e));
        e.put("approved",true);denied(()->call("decode",new Class<?>[]{Object.class},e));e.remove("approved");
        nested(e,"lighting").put("ambientMilli",.5d);denied(()->call("decode",new Class<?>[]{Object.class},e));nested(e,"lighting").put("ambientMilli",500L);
        row(e,"tiers",2).put("maxDecodedBytes",4097L);denied(()->call("decode",new Class<?>[]{Object.class},e));row(e,"tiers",2).put("maxDecodedBytes",4096L);
        row(e,"items",0).put("childSafe",false);denied(()->call("decode",new Class<?>[]{Object.class},e));row(e,"items",0).put("childSafe",true);
        nested(e,"fallback").put("preserveBooky",false);denied(()->call("decode",new Class<?>[]{Object.class},e));
    }
    @Test public void actualNativeChecksumBindsSceneSlotsProfileAndCurrentPlatform()throws Exception {
        Map<String,Object> e=engine(),root=root(e),review=map("engineCompositionChecksum",checksum(e),"platforms",Arrays.asList("android-google"));check(root,review,9L,8L,"android-google");
        nested(e,"transition").put("durationMs",301L);denied(()->check(root,review,9L,8L,"android-google"));nested(e,"transition").put("durationMs",300L);
        denied(()->check(root,review,18L,8L,"android-google"));denied(()->check(root,review,9L,8L,"ios-ipados"));
        nested(root,"skin").put("assetId","other-skin");denied(()->check(root,review,9L,8L,"android-google"));nested(root,"skin").put("assetId","fixture-skin");
        e.put("modelPackageVersion",2L);review.put("engineCompositionChecksum",checksum(e));denied(()->check(root,review,9L,8L,"android-google"));
    }
    static byte[] png(int width,int height)throws Exception {
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();out.write(new byte[]{(byte)137,80,78,71,13,10,26,10});java.nio.ByteBuffer header=java.nio.ByteBuffer.allocate(13);header.putInt(width).putInt(height).put((byte)8).put((byte)6).put(new byte[]{0,0,0});chunk(out,"IHDR",header.array());
        java.io.ByteArrayOutputStream compressed=new java.io.ByteArrayOutputStream();try(java.util.zip.DeflaterOutputStream z=new java.util.zip.DeflaterOutputStream(compressed)){z.write(new byte[height*(1+width*4)]);}chunk(out,"IDAT",compressed.toByteArray());chunk(out,"IEND",new byte[0]);return out.toByteArray();
    }
    static void chunk(java.io.ByteArrayOutputStream out,String type,byte[] data)throws Exception { byte[] name=type.getBytes(StandardCharsets.US_ASCII);java.io.DataOutputStream stream=new java.io.DataOutputStream(out);stream.writeInt(data.length);stream.write(name);stream.write(data);java.util.zip.CRC32 crc=new java.util.zip.CRC32();crc.update(name);crc.update(data);stream.writeInt((int)crc.getValue()); }
    @Test public void nativePreflightAndBitmapUseActualRasterDimensions()throws Exception {
        Map<String,Object> root=root(engine());byte[] bytes=png(2,1);PlanetChildMedia.Header header=PlanetChildMedia.preflight(bytes,"image/png");assertEquals(2,header.width);assertEquals(1,header.height);call("dimensions",new Class<?>[]{Map.class,String.class,int.class,int.class},root,"skin",header.width,header.height);
        android.graphics.Bitmap bitmap=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.length);try{assertNotNull(bitmap);assertEquals(header.width,bitmap.getWidth());assertEquals(header.height,bitmap.getHeight());}finally{if(bitmap!=null)bitmap.recycle();Arrays.fill(bytes,(byte)0);}
        denied(()->call("dimensions",new Class<?>[]{Map.class,String.class,int.class,int.class},root,"skin",4,2));
    }
    @Test public void signedStaticBudgetPreservesSkinBackgroundAndRequiresEconomyPermission()throws Exception {
        Map<String,Object> e=engine(),root=root(e);for(int i=0;i<3;i++){row(e,"tiers",i).put("maxDecodedBytes",17L);row(e,"tiers",i).put("maxResidentBytes",131072L);}
        denied(()->call("budget",new Class<?>[]{Map.class,String.class,long.class,long.class},root,"economy",0L,0L));denied(()->call("staticBudget",new Class<?>[]{Map.class},root));nested(e,"fallback").put("staticAllowed",true);call("staticBudget",new Class<?>[]{Map.class},root);
        row(e,"tiers",2).put("maxDecodedBytes",16L);denied(()->call("staticBudget",new Class<?>[]{Map.class},root));row(e,"tiers",2).put("maxDecodedBytes",17L);
        row(e,"items",0).put("tiers",Arrays.asList("high"));denied(()->call("staticBudget",new Class<?>[]{Map.class},root));
    }
    static Throwable cause(Attempt body)throws Exception { try{body.run();fail("Expected native denial");return null;}catch(InvocationTargetException error){assertNotNull(error.getCause());return error.getCause();} }
    static void typed(Throwable error,String reason)throws Exception { assertEquals("ru.probpera.literaryplanet.PlanetChildVault$LocalV2SceneBudgetDeclined",error.getClass().getName());Field field=error.getClass().getDeclaredField("reason");field.setAccessible(true);assertEquals(reason,field.get(error)); }
    @Test public void explicitCapacityReasonsStayDistinctFromMalformedMetadataAndPermissions()throws Exception {
        Map<String,Object> e=engine(),root=root(e);Class<?>[] budget={Map.class,String.class,long.class,long.class};
        typed(cause(()->call("budget",budget,root,"high",4096L,0L)),"decoded-budget");typed(cause(()->call("budget",budget,root,"high",0L,2L)),"triangle-budget");
        row(e,"tiers",0).put("maxDecodedBytes",.5d);Throwable malformed=cause(()->call("budget",budget,root,"high",4096L,0L));assertFalse(malformed.getClass().getName().endsWith("LocalV2SceneBudgetDeclined"));row(e,"tiers",0).put("maxDecodedBytes",4096L);
        row(e,"items",0).put("tiers",Arrays.asList("economy"));Throwable forbidden=cause(()->call("budget",budget,root,"high",4096L,0L));assertFalse(forbidden.getClass().getName().endsWith("LocalV2SceneBudgetDeclined"));
        // None of these pure computations constructs a resource permit. Its
        // private factory remains reachable only from the original owner.
        for(Constructor<?> constructor:PlanetChildVault.LocalV2WebOutputPermit.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
    }
    @Test public void legacyModelLessSceneHasNoEngineBudgetOrWireEnvelope()throws Exception {
        Map<String,Object> legacy=map("schemaVersion",2L);
        assertNull(call("policy",new Class<?>[]{Map.class,String.class},legacy,"high"));
        assertEquals(0L,call("base",new Class<?>[]{Map.class,boolean.class},legacy,false));
        call("budget",new Class<?>[]{Map.class,String.class,long.class,long.class},legacy,"high",0L,0L);
        call("partialBudget",new Class<?>[]{Map.class,Set.class,String.class,long.class},legacy,Collections.singleton("legacy:skin"),null,0L);
        Map<String,Object> core=map("schemaVersion",1L,"packageId","original-core");legacy.put("schemaVersion",3L);legacy.put("modelPackage",core);
        assertSame(core,call("wire",new Class<?>[]{Map.class},legacy));
    }
}