package ru.probpera.literaryplanet;

import static org.junit.Assert.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.ByteArrayInputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** AUTHORED_NOT_RUN. Synthetic import/storage and genuine-fixture-only native
 * transaction probes; no release review, renderer/GPU or device acceptance. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildCommon3dRuntimeTest {
    private interface Checked {void run()throws Exception;}
    private static void denied(Checked probe)throws Exception {try{probe.run();fail("Expected common 3D refusal");}catch(Exception expected){assertTrue(expected instanceof PlanetChildVault.Unavailable||expected instanceof PlanetChildDataStore.Unavailable||expected instanceof java.nio.charset.CharacterCodingException||expected.getClass().getSimpleName().equals("PinKnownRefusal"));}}
    private static Map<String,Object> map(Object...fields){Map<String,Object> row=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)row.put((String)fields[i],fields[i+1]);return row;}
    private static String hash(byte[] bytes)throws Exception {StringBuilder out=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-256").digest(bytes))out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
    private static byte[] mesh() {
        ByteBuffer b=ByteBuffer.allocate(42).order(ByteOrder.LITTLE_ENDIAN);
        for(float n:new float[]{2,0,0,3,0,0,2,1,0})b.putFloat(n);b.putShort((short)0).putShort((short)1).putShort((short)2);return b.array();
    }
    private static byte[] model(boolean glb) {
        String buffer=glb?"{\"byteLength\":42}":"{\"uri\":\"mesh.bin\",\"byteLength\":42}";
        return ("{\"asset\":{\"version\":\"2.0\"},\"scene\":0,\"scenes\":[{\"nodes\":[0]}],\"nodes\":[{\"mesh\":0}],"+
            "\"meshes\":[{\"primitives\":[{\"attributes\":{\"POSITION\":0},\"indices\":1}]}],\"buffers\":["+buffer+"],"+
            "\"bufferViews\":[{\"buffer\":0,\"byteLength\":36},{\"buffer\":0,\"byteOffset\":36,\"byteLength\":6}],"+
            "\"accessors\":[{\"bufferView\":0,\"componentType\":5126,\"count\":3,\"type\":\"VEC3\"},{\"bufferView\":1,\"componentType\":5123,\"count\":3,\"type\":\"SCALAR\"}]}").getBytes(StandardCharsets.UTF_8);
    }
    private static byte[] glb() {
        byte[] json=model(true),buffer=mesh();int n=(json.length+3)&~3;ByteBuffer b=ByteBuffer.allocate(12+8+n+8+44).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x46546c67).putInt(2).putInt(b.capacity()).putInt(n).putInt(0x4e4f534a).put(json);while(b.position()<20+n)b.put((byte)32);
        b.putInt(44).putInt(0x004e4942).put(buffer);while(b.hasRemaining())b.put((byte)0);return b.array();
    }
    private static PlanetChildModelImport.Layout importer(byte[] bytes)throws Exception {return PlanetChildModelImport.importModel(bytes,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1);}
    private static Map<String,Object> resource(String id,String kind,String alias,String mime,byte[] bytes)throws Exception {
        return map("assetId",id,"entity",map("kind","background","id",id,"contentChecksum","a".repeat(64)),"mime",mime,"checksum",hash(bytes),"encodedBytes",(long)bytes.length,"alias",alias,"kind",kind);
    }
    private static Map<String,Object> pack()throws Exception {
        Map<String,Object> m=map("slotId","background","model",resource("common-model","model","scene.gltf","model/gltf+json",model(false)),
            "dependencies",Collections.singletonList(resource("common-buffer","buffer","mesh.bin","application/octet-stream",mesh())),
            "bounds",map("min",Arrays.asList(2L,0L,0L),"max",Arrays.asList(3L,1L,0L)));
        List<Object> tiers=new ArrayList<>();for(String tier:Arrays.asList("high","balanced","economy"))tiers.add(map("tier",tier,"maxDecodedBytes",4096L,"maxTriangles",1L,"models",Collections.singletonList(m)));
        return map("schemaVersion",1L,"packageId","synthetic-common","packageVersion",2L,"minAppVersion",1L,"formatProfile","gltf2-static-v1","tiers",tiers);
    }
    @Test public void encodedInterleavedPaddingDoesNotConsumeTheDecodedGeometryBudget()throws Exception {
        ByteBuffer padded=ByteBuffer.allocate(762).order(ByteOrder.LITTLE_ENDIAN);float[] vertices={2,0,0,3,0,0,2,1,0};
        for(int v=0;v<3;v++)for(int k=0;k<3;k++)padded.putFloat(v*252+k*4,vertices[v*3+k]);padded.putShort(756,(short)0).putShort(758,(short)1).putShort(760,(short)2);
        Map<String,Object> raw=nativeRow(PlanetChildModelImport.json(model(false),1048576));raw.put("buffers",Collections.singletonList(map("uri","mesh.bin","byteLength",762L)));raw.put("bufferViews",Arrays.asList(map("buffer",0L,"byteLength",756L,"byteStride",252L),map("buffer",0L,"byteOffset",756L,"byteLength",6L)));
        byte[] json=new org.json.JSONObject(raw).toString().getBytes(StandardCharsets.UTF_8),buffer=padded.array();Map<String,Object> signed=pack();
        for(Object item:nativeList(signed.get("tiers"))){Map<String,Object> tier=nativeRow(item);tier.put("maxDecodedBytes",100L);Map<String,Object> m=nativeRow(nativeList(tier.get("models")).get(0));m.put("model",resource("common-model","model","scene.gltf","model/gltf+json",json));m.put("dependencies",Collections.singletonList(resource("common-buffer","buffer","mesh.bin","application/octet-stream",buffer)));}
        assertEquals(6,PlanetChildModelImport.bindings(signed).size());PlanetChildModelImport.Layout layout=PlanetChildModelImport.importModel(json,"model/gltf+json",Collections.singletonMap("mesh.bin",762),Collections.emptySet(),100,1,new double[]{2,0,0},new double[]{3,1,0});
        assertEquals(84,layout.decodedBytes);layout.closure(json,Collections.singletonMap("mesh.bin",buffer),true,()->{});denied(()->PlanetChildModelImport.importModel(json,"model/gltf+json",Collections.singletonMap("mesh.bin",762),Collections.emptySet(),83,1));Arrays.fill(buffer,(byte)0);
    }
    @Test public void syntheticAndroidGltfImportsThenDecodesActualPositionAndIndices()throws Exception {
        PlanetChildModelImport.Layout layout=importer(model(false));assertEquals(1,layout.triangles);assertEquals(Integer.valueOf(42),layout.buffers.get("mesh.bin"));layout.decode("mesh.bin",mesh());
        byte[] nonfinite=mesh();ByteBuffer.wrap(nonfinite).order(ByteOrder.LITTLE_ENDIAN).putFloat(0,Float.NaN);denied(()->layout.decode("mesh.bin",nonfinite));
        byte[] outside=mesh();ByteBuffer.wrap(outside).order(ByteOrder.LITTLE_ENDIAN).putFloat(0,13f);denied(()->layout.decode("mesh.bin",outside));
        byte[] indices=mesh();ByteBuffer.wrap(indices).order(ByteOrder.LITTLE_ENDIAN).putShort(36,(short)3);denied(()->layout.decode("mesh.bin",indices));
        denied(()->layout.decode("undeclared.bin",mesh()));denied(()->layout.decode("mesh.bin",new byte[41]));
    }
    @Test public void syntheticAndroidGlbDecodesEmbeddedBufferAndRefusesChangedChunks()throws Exception {
        byte[] original=glb();PlanetChildModelImport.Layout layout=PlanetChildModelImport.importModel(original,"model/gltf-binary",Collections.emptyMap(),Collections.emptySet(),4096,1);assertEquals(1,layout.triangles);
        byte[] wrongVersion=original.clone();ByteBuffer.wrap(wrongVersion).order(ByteOrder.LITTLE_ENDIAN).putInt(4,1);denied(()->PlanetChildModelImport.preflight(wrongVersion,"model/gltf-binary"));
        byte[] badSize=original.clone();ByteBuffer.wrap(badSize).order(ByteOrder.LITTLE_ENDIAN).putInt(8,badSize.length-4);denied(()->PlanetChildModelImport.preflight(badSize,"model/gltf-binary"));
        byte[] badIndices=original.clone();ByteBuffer.wrap(badIndices).order(ByteOrder.LITTLE_ENDIAN).putShort(badIndices.length-8,(short)3);denied(()->PlanetChildModelImport.preflight(badIndices,"model/gltf-binary"));
        denied(()->PlanetChildModelImport.importModel(original,"model/gltf-binary",Collections.singletonMap("extra.bin",42),Collections.emptySet(),4096,1));
    }
    @Test public void AndroidImportRejectsExternalDataTraversalAndOrphanDependencies()throws Exception {
        String source=new String(model(false),StandardCharsets.UTF_8);for(String uri:Arrays.asList("https://assets.example.com/a.bin","data:application/octet-stream;base64,AAAA","../mesh.bin","mesh%2ebin","mesh.bin?x=1")) {
            byte[] bytes=source.replace("mesh.bin",uri).getBytes(StandardCharsets.UTF_8);denied(()->importer(bytes));
        }
        denied(()->PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("other.bin",42),Collections.emptySet(),4096,1));
        denied(()->PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.singleton("orphan.png"),4096,1));
    }
    @Test public void AndroidImportRejectsExtensionsUnknownFieldsAndDuplicateJson()throws Exception {
        String source=new String(model(false),StandardCharsets.UTF_8);for(String field:Arrays.asList("\"extensionsUsed\":[\"EXT_meshopt_compression\"]","\"extensionsRequired\":[\"KHR_draco_mesh_compression\"]","\"animations\":[]","\"cameras\":[]","\"skins\":[]","\"callerPermission\":true")) {
            byte[] bytes=(source.substring(0,source.length()-1)+","+field+"}").getBytes(StandardCharsets.UTF_8);denied(()->importer(bytes));
        }
        byte[] duplicate=source.replace("\"scene\":0","\"scene\":0,\"scene\":0").getBytes(StandardCharsets.UTF_8);denied(()->importer(duplicate));
        byte[] malformed={(byte)0xc0,(byte)0xaf};denied(()->PlanetChildModelImport.preflight(malformed,"model/gltf+json"));
    }
    @Test public void AndroidImportRequiresIndexedTrianglesRangesAndDecodedBudget()throws Exception {
        String source=new String(model(false),StandardCharsets.UTF_8);
        for(String changed:Arrays.asList(source.replace(",\"indices\":1",""),source.replace("\"indices\":1","\"indices\":1,\"mode\":1"),
            source.replace("\"byteOffset\":36","\"byteOffset\":40"),source.replace("\"count\":3","\"count\":4"),source.replace("\"componentType\":5126","\"componentType\":5123"))) {
            byte[] bytes=changed.getBytes(StandardCharsets.UTF_8);denied(()->importer(bytes));
        }
        denied(()->PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),47,1));
        denied(()->PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),83,1));
        assertEquals(1,PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),84,1).triangles);
        byte[] instances=source.replace("\"nodes\":[0]","\"nodes\":[0,1]").replace("\"nodes\":[{\"mesh\":0}]","\"nodes\":[{\"mesh\":0},{\"mesh\":0}]").getBytes(StandardCharsets.UTF_8);
        denied(()->PlanetChildModelImport.importModel(instances,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1));
        assertEquals(2,PlanetChildModelImport.importModel(instances,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,2).triangles);
        byte[] unused=source.replace("\"nodes\":[{\"mesh\":0}]","\"nodes\":[{}]").getBytes(StandardCharsets.UTF_8);denied(()->importer(unused));
        denied(()->PlanetChildModelImport.importModel(model(false),"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,0));
    }
    @Test public void AndroidImportRejectsUnreachableCycleAndUnboundedTransforms()throws Exception {
        String source=new String(model(false),StandardCharsets.UTF_8);for(String changed:Arrays.asList(
            source.replace("\"nodes\":[{\"mesh\":0}]","\"nodes\":[{\"mesh\":0,\"children\":[0]}]"),
            source.replace("\"nodes\":[{\"mesh\":0}]","\"nodes\":[{\"mesh\":0},{}]"),
            source.replace("\"mesh\":0}","\"mesh\":0,\"translation\":[13,0,0]}"),
            source.replace("\"mesh\":0}","\"mesh\":0,\"scale\":[0,1,1]}"),
            source.replace("\"mesh\":0}","\"mesh\":0,\"rotation\":[0,0,0,0]}"),
            source.replace("\"mesh\":0}","\"mesh\":0,\"matrix\":[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}"))) {
            byte[] bytes=changed.getBytes(StandardCharsets.UTF_8);denied(()->importer(bytes));
        }
    }
    @SuppressWarnings("unchecked") @Test public void NativeDescriptorBindsThreeTiersTypedIdentityVersionAndClearance()throws Exception {
        Map<String,Object> p=pack();assertEquals(6,PlanetChildModelImport.bindings(p).size());PlanetChildModelImport.validateSceneId(p,"synthetic-common.v2");
        denied(()->PlanetChildModelImport.validateSceneId(p,"synthetic-common.v1"));denied(()->PlanetChildModelImport.resolve(p,"high","texture","common-buffer"));
        Map<String,Object> tier=(Map<String,Object>)((List<?>)p.get("tiers")).get(0);tier.put("tier","economy");denied(()->PlanetChildModelImport.bindings(p));tier.put("tier","high");
        Map<String,Object> model=(Map<String,Object>)((List<?>)tier.get("models")).get(0);model.put("bounds",map("min",Arrays.asList(-13L,-1L,-1L),"max",Arrays.asList(1L,1L,1L)));denied(()->PlanetChildModelImport.bindings(p));
    }
    @Test public void NativeTypedAcquisitionWireCannotAddUriOrSkipTierBinding()throws Exception {
        Map<String,Object> r=map("version",2L,"requestId","1".repeat(32),"contextToken","2".repeat(32),"sceneToken","3".repeat(32),"slotId","model","assetId","common-model","tier","balanced");
        PlanetChildDataTransport.V2Request decoded=PlanetChildDataTransport.decodeV2("acquireWebResource",r);assertEquals("balanced",decoded.tier);assertEquals("common-model",decoded.assetId);
        r.put("uri","https://assets.example.com/a.glb");denied(()->PlanetChildDataTransport.decodeV2("acquireWebResource",r));r.remove("uri");r.remove("tier");denied(()->PlanetChildDataTransport.decodeV2("acquireWebResource",r));
        r.put("tier","high");r.put("slotId","background");denied(()->PlanetChildDataTransport.decodeV2("acquireWebResource",r));
    }
    @Test public void NativeBinaryReaderUsesActualHashLengthAndOwnedBytes()throws Exception {
        byte[] original=mesh();byte[] acquired=PlanetChildResources.boundedBody(new ByteArrayInputStream(original),original.length,hash(original));assertNotSame(original,acquired);
        importer(model(false)).decode("mesh.bin",acquired);assertEquals("/objects/"+hash(original)+".bin",PlanetChildResources.canonicalPath(hash(original),"application/octet-stream"));
        assertEquals("/objects/"+hash(model(false))+".gltf",PlanetChildResources.canonicalPath(hash(model(false)),"model/gltf+json"));
        byte[] changed=original.clone();changed[0]^=1;denied(()->PlanetChildResources.boundedBody(new ByteArrayInputStream(changed),original.length,hash(original)));Arrays.fill(acquired,(byte)0);
    }
    @Test public void SharedBinaryObjectCatalogColdCodecDeduplicatesWithinProfileAndSeparatesProfiles()throws Exception {
        byte[] bytes=mesh();String sha=hash(bytes);PlanetChildRouteDownload.ObjectRef ru=new PlanetChildRouteDownload.ObjectRef("profile-one",sha,"application/octet-stream",bytes.length);
        PlanetChildRouteDownload.ObjectRef en=new PlanetChildRouteDownload.ObjectRef("profile-one",sha,"application/octet-stream",bytes.length);assertEquals(ru,en);
        PlanetChildRouteDownload.ObjectRef other=new PlanetChildRouteDownload.ObjectRef("profile-two",sha,"application/octet-stream",bytes.length);assertNotEquals(ru,other);
        try(PlanetChildRouteDownload.Catalog catalog=new PlanetChildRouteDownload.Catalog()){catalog.objects.put(ru.key(),ru);catalog.objects.put(en.key(),en);catalog.objects.put(other.key(),other);byte[] encoded=catalog.encode();
            try(PlanetChildRouteDownload.Catalog cold=PlanetChildRouteDownload.Catalog.decode(encoded)){assertEquals(2,cold.objects.size());assertEquals(ru,cold.objects.get(ru.key()));assertEquals(other,cold.objects.get(other.key()));}finally{Arrays.fill(encoded,(byte)0);}}
        denied(()->new PlanetChildRouteDownload.ObjectRef("profile-one",sha,"image/ktx2",bytes.length));
    }
    @Test public void SyntheticImportsAndDescriptorsNeverMintOriginalResourceAuthority()throws Exception {
        importer(model(false)).decode("mesh.bin",mesh());PlanetChildModelImport.bindings(pack());
        for(Constructor<?> constructor:PlanetChildVault.LocalV2ResourceClaim.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        for(Constructor<?> constructor:PlanetChildResources.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));denied(()->PlanetChildResources.original(null));
    }

    @Test public void NativeChunkWireBindsTokensOffsetsAndRejectsCallerBytesOrUri()throws Exception {
        Map<String,Object> r=map("version",2L,"requestId","1".repeat(32),"contextToken","2".repeat(32),"sceneToken","3".repeat(32),"resourceToken","4".repeat(32),"offset",33554431L,"byteLength",1L);
        PlanetChildDataTransport.V2Request q=PlanetChildDataTransport.decodeV2("readWebResourceChunk",r);assertEquals(33554431L,q.offset);assertEquals(1,q.byteLength);assertEquals(r.get("sceneToken"),q.sceneToken);assertEquals(r.get("resourceToken"),q.resourceToken);
        for(String field:Arrays.asList("uri","encodedBase64","assetId","tier","slotId")){r.put(field,"caller");denied(()->PlanetChildDataTransport.decodeV2("readWebResourceChunk",r));r.remove(field);}
        for(Object value:Arrays.asList(-1L,33554432L,Long.MAX_VALUE,-0.0d,0.5d,Double.NaN,Double.POSITIVE_INFINITY,"0",null)){r.put("offset",value);denied(()->PlanetChildDataTransport.decodeV2("readWebResourceChunk",r));}r.put("offset",0L);
        for(Object value:Arrays.asList(0L,65537L,Long.MAX_VALUE,-0.0d,1.5d,"1",null)){r.put("byteLength",value);denied(()->PlanetChildDataTransport.decodeV2("readWebResourceChunk",r));}r.put("byteLength",65536L);
        assertEquals(65536,PlanetChildDataTransport.decodeV2("readWebResourceChunk",r).byteLength);
        for(String field:Arrays.asList("sceneToken","resourceToken")){Object original=r.get(field);r.put(field,"A".repeat(32));denied(()->PlanetChildDataTransport.decodeV2("readWebResourceChunk",r));r.remove(field);denied(()->PlanetChildDataTransport.decodeV2("readWebResourceChunk",r));r.put(field,original);}
        assertNotNull(PlanetChildPlugin.class.getDeclaredMethod("readWebResourceChunk",com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));
    }
    @Test public void NativeChunkCopyRangeIsBoundedAndChunkConstructionCannotMintOutputAuthority()throws Exception {
        PlanetChildWebResources.Output.chunkRange(1,0,1);PlanetChildWebResources.Output.chunkRange(33554432,0,65536);PlanetChildWebResources.Output.chunkRange(33554432,33554431L,1);
        for(long[] row:new long[][]{{0,0,1},{33554433,0,1},{42,-1,1},{42,42,1},{42,Long.MAX_VALUE,1},{42,0,0},{33554432,0,65537},{42,41,2}})
            denied(()->PlanetChildWebResources.Output.chunkRange((int)row[0],row[1],(int)row[2]));
        for(Constructor<?> constructor:PlanetChildWebResources.Output.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        for(Constructor<?> constructor:PlanetChildWebResources.Output.Chunk.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
    }
    private static byte[] topologyDocument(int vertices,int indices,int bytes)throws Exception {
        Map<String,Object> root=nativeRow(PlanetChildModelImport.json(model(false),1048576));root.put("buffers",Collections.singletonList(map("uri","mesh.bin","byteLength",(long)bytes)));
        root.put("bufferViews",Arrays.asList(map("buffer",0L,"byteLength",(long)vertices*12),map("buffer",0L,"byteOffset",(long)vertices*12,"byteLength",(long)indices*2)));
        root.put("accessors",Arrays.asList(map("bufferView",0L,"componentType",5126L,"count",(long)vertices,"type","VEC3"),map("bufferView",1L,"componentType",5123L,"count",(long)indices,"type","SCALAR")));
        return new org.json.JSONObject(root).toString().getBytes(StandardCharsets.UTF_8);
    }
    private static byte[] topologyBuffer(float[] vertices,int[] indices) {
        ByteBuffer bytes=ByteBuffer.allocate(vertices.length*4+indices.length*2).order(ByteOrder.LITTLE_ENDIAN);for(float v:vertices)bytes.putFloat(v);for(int v:indices)bytes.putShort((short)v);return bytes.array();
    }
    @Test public void actualIndexedWorldClosureAdmitsEnclosingRoomButRefusesClippingOrDegenerateTriangles()throws Exception {
        float[] vertices={-3,-3,-3,3,-3,-3,3,3,-3,-3,3,-3,-3,-3,3,3,-3,3,3,3,3,-3,3,3};
        int[] indices={0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2};
        byte[] buffer=topologyBuffer(vertices,indices),document=topologyDocument(8,36,buffer.length);PlanetChildModelImport.Layout room=PlanetChildModelImport.importModel(document,"model/gltf+json",Collections.singletonMap("mesh.bin",buffer.length),Collections.emptySet(),4096,12,new double[]{-3,-3,-3},new double[]{3,3,3});
        final int[] checks={0};room.closure(document,Collections.singletonMap("mesh.bin",buffer),true,()->checks[0]++);assertEquals(12,room.triangles);assertTrue(checks[0]>0);
        Map<String,Object> packageRow=pack();for(Object tier:nativeList(packageRow.get("tiers")))for(Object descriptor:nativeList(nativeRow(tier).get("models")))nativeRow(descriptor).put("bounds",map("min",Arrays.asList(-3L,-3L,-3L),"max",Arrays.asList(3L,3L,3L)));assertEquals(6,PlanetChildModelImport.bindings(packageRow).size());
        byte[] clipped=topologyBuffer(new float[]{-3,-3,0,3,-3,0,0,3,0},new int[]{0,1,2}),face=topologyDocument(3,3,clipped.length);PlanetChildModelImport.Layout crossing=importer(face);denied(()->crossing.closure(face,Collections.singletonMap("mesh.bin",clipped),true,()->{}));
        byte[] flat=topologyBuffer(new float[]{2,0,0,3,0,0,4,0,0},new int[]{0,1,2});denied(()->crossing.closure(face,Collections.singletonMap("mesh.bin",flat),false,()->{}));
        denied(()->room.closure(document,Collections.singletonMap("mesh.bin",buffer),true,()->{throw new PlanetChildVault.Unavailable();}));
        room.closure(document,Collections.singletonMap("mesh.bin",buffer),true,()->{});Arrays.fill(buffer,(byte)0);Arrays.fill(clipped,(byte)0);Arrays.fill(flat,(byte)0);
    }
    @SuppressWarnings("unchecked") private static List<Object> nativeList(Object raw){assertTrue(raw instanceof List);return (List<Object>)raw;}
    @Test public void nativeTexturedPrimitiveRequiresUVAndRecordsEveryTextureIndexClone()throws Exception {
        Map<String,Object> root=nativeRow(PlanetChildModelImport.json(model(false),1048576));root.put("images",Collections.singletonList(map("uri","paint.png")));root.put("textures",Arrays.asList(map("source",0L),map("source",0L,"sampler",0L)));root.put("samplers",Collections.singletonList(map("wrapS",33071L)));
        root.put("materials",Arrays.asList(map("pbrMetallicRoughness",map("baseColorTexture",map("index",0L))),map("pbrMetallicRoughness",map("baseColorTexture",map("index",1L)))));
        root.put("meshes",Collections.singletonList(map("primitives",Arrays.asList(map("attributes",map("POSITION",0L),"indices",1L,"material",0L),map("attributes",map("POSITION",0L),"indices",1L,"material",1L)))));
        byte[] noUV=new org.json.JSONObject(root).toString().getBytes(StandardCharsets.UTF_8);denied(()->PlanetChildModelImport.importModel(noUV,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.singleton("paint.png"),4096,2));
        root.put("buffers",Collections.singletonList(map("uri","mesh.bin","byteLength",68L)));root.put("bufferViews",Arrays.asList(map("buffer",0L,"byteLength",36L),map("buffer",0L,"byteOffset",36L,"byteLength",6L),map("buffer",0L,"byteOffset",44L,"byteLength",24L)));
        root.put("accessors",Arrays.asList(map("bufferView",0L,"componentType",5126L,"count",3L,"type","VEC3"),map("bufferView",1L,"componentType",5123L,"count",3L,"type","SCALAR"),map("bufferView",2L,"componentType",5126L,"count",3L,"type","VEC2")));
        for(Object primitive:nativeList(nativeRow(nativeList(root.get("meshes")).get(0)).get("primitives")))nativeRow(primitive).put("attributes",map("POSITION",0L,"TEXCOORD_0",2L));
        byte[] withUV=new org.json.JSONObject(root).toString().getBytes(StandardCharsets.UTF_8);PlanetChildModelImport.Layout imported=PlanetChildModelImport.importModel(withUV,"model/gltf+json",Collections.singletonMap("mesh.bin",68),Collections.singleton("paint.png"),4096,2);assertEquals(Integer.valueOf(2),imported.textureUses.get("paint.png"));
    }
    private static byte[] topologyGlb(byte[] json,byte[] buffer) {
        int n=(json.length+3)&~3,k=(buffer.length+3)&~3;ByteBuffer bytes=ByteBuffer.allocate(28+n+k).order(ByteOrder.LITTLE_ENDIAN);bytes.putInt(0x46546c67).putInt(2).putInt(bytes.capacity()).putInt(n).putInt(0x4e4f534a).put(json);while(bytes.position()<20+n)bytes.put((byte)32);bytes.putInt(k).putInt(0x004e4942).put(buffer);while(bytes.hasRemaining())bytes.put((byte)0);return bytes.array();
    }
    @Test public void GLBProfileRequiresExactlyOneUriFreeEmbeddedBufferAndLogicalBinRange()throws Exception {
        byte[] embedded=glb();PlanetChildModelImport.Layout layout=PlanetChildModelImport.importModel(embedded,"model/gltf-binary",Collections.emptyMap(),Collections.emptySet(),4096,1);layout.closure(embedded,Collections.emptyMap(),true,()->{});
        byte[] external=topologyGlb(model(false),mesh());denied(()->PlanetChildModelImport.importModel(external,"model/gltf-binary",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1));
        byte[] nullable=topologyGlb(new String(model(true),StandardCharsets.UTF_8).replace("\"byteLength\":42","\"uri\":null,\"byteLength\":42").getBytes(StandardCharsets.UTF_8),mesh());denied(()->PlanetChildModelImport.importModel(nullable,"model/gltf-binary",Collections.emptyMap(),Collections.emptySet(),4096,1));
        byte[] paddingView=topologyGlb(new String(model(true),StandardCharsets.UTF_8).replace("\"byteOffset\":36,\"byteLength\":6","\"byteOffset\":36,\"byteLength\":8").getBytes(StandardCharsets.UTF_8),mesh());denied(()->PlanetChildModelImport.preflight(paddingView,"model/gltf-binary"));
    }
    private static Object nativeField(Object value,String name)throws Exception {java.lang.reflect.Field f=value.getClass().getDeclaredField(name);f.setAccessible(true);return f.get(value);}
    @SuppressWarnings("unchecked") private static Map<String,Object> nativeRow(Object raw){assertTrue(raw instanceof Map);return (Map<String,Object>)raw;}
    private static Map<String,Object> nativeRequest(String token){return map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken",token);}
    private static Map<String,Object> nativeCall(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request)throws Exception {
        java.util.concurrent.CountDownLatch joined=new java.util.concurrent.CountDownLatch(1);java.util.concurrent.atomic.AtomicReference<Map<String,Object>> answer=new java.util.concurrent.atomic.AtomicReference<>();
        PlanetChildDataTransport.V2Request dto=PlanetChildDataTransport.decodeV2(method,request);
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync(()->owner.execute(dto,value->{answer.set(value);joined.countDown();}));
        assertTrue("Actual original native command must join",joined.await(10,java.util.concurrent.TimeUnit.SECONDS));assertNotNull(answer.get());long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(10);while(Boolean.TRUE.equals(nativeField(owner,"busy"))&&System.nanoTime()<deadline)java.util.concurrent.TimeUnit.MILLISECONDS.sleep(1);assertEquals("Original command cleanup must join before the next request",Boolean.FALSE,nativeField(owner,"busy"));return answer.get();
    }
    private static Map<String,Object> nativeData(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request)throws Exception {
        Map<String,Object> reply=nativeCall(owner,method,request);assertEquals("ok",reply.get("status"));return nativeRow(reply.get("value"));
    }
    private static Map<String,Object> nativeAcquire(PlanetChildVault.LocalV2AppOwner owner,String context,String scene,String slot,PlanetChildModelImport.Binding typed)throws Exception {
        Map<String,Object> request=nativeRequest(context);request.put("sceneToken",scene);request.put("slotId",slot);
        if(typed!=null){request.put("assetId",typed.assetId);request.put("tier",typed.tier);}
        Map<String,Object> acquired=nativeData(owner,"acquireWebResource",request);assertEquals("available",acquired.get("status"));assertEquals(scene,acquired.get("sceneToken"));return acquired;
    }
    private static Map<String,Object> nativeChunk(PlanetChildVault.LocalV2AppOwner owner,String context,String scene,String resource,int offset,int length)throws Exception {
        Map<String,Object> request=nativeRequest(context);request.put("sceneToken",scene);request.put("resourceToken",resource);request.put("offset",(long)offset);request.put("byteLength",(long)length);
        return nativeData(owner,"readWebResourceChunk",request);
    }
    private static void nativeUnavailableChunk(PlanetChildVault.LocalV2AppOwner owner,String context,String scene,String resource)throws Exception {
        Map<String,Object> value=nativeChunk(owner,context,scene,resource,0,1);assertEquals(new HashSet<>(Arrays.asList("status","sceneToken","resourceToken")),value.keySet());assertEquals("unavailable",value.get("status"));assertEquals(scene,value.get("sceneToken"));assertEquals(resource,value.get("resourceToken"));
    }
    /** Uses the original SDK and retained authenticated Output. Neither URI nor
     * synthetic bytes are accepted, and every copied array is cleared. */
    private static void nativeReadChunks(PlanetChildVault.LocalV2AppOwner owner,String context,String scene,Map<String,Object> acquired)throws Exception {
        int total=((Number)acquired.get("encodedBytes")).intValue();assertTrue(total>0&&total<=33554432);byte[] assembled=new byte[total];String resource=(String)acquired.get("resourceToken");
        try {
            for(int offset=0;offset<total;){int length=Math.min(65536,total-offset);Map<String,Object> value=nativeChunk(owner,context,scene,resource,offset,length);
                assertEquals(new HashSet<>(Arrays.asList("status","sceneToken","resourceToken","offset","totalBytes","mime","encodedBase64","remainingLifetimeMs")),value.keySet());
                assertEquals("available",value.get("status"));assertEquals(scene,value.get("sceneToken"));assertEquals(resource,value.get("resourceToken"));assertEquals((long)offset,((Number)value.get("offset")).longValue());assertEquals((long)total,((Number)value.get("totalBytes")).longValue());assertEquals(acquired.get("mime"),value.get("mime"));
                long remaining=((Number)value.get("remainingLifetimeMs")).longValue();assertTrue(remaining>0&&remaining<=60000);String encoded=(String)value.get("encodedBase64");byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.NO_WRAP);
                try{assertEquals(length,bytes.length);assertEquals(encoded,android.util.Base64.encodeToString(bytes,android.util.Base64.NO_WRAP));System.arraycopy(bytes,0,assembled,offset,length);}finally{Arrays.fill(bytes,(byte)0);}
                PlanetChildWebResources.Output out=(PlanetChildWebResources.Output)nativeRow(nativeField(owner,"webOutputs")).get(resource);assertNotNull(out);assertTrue(((Set<?>)nativeField(out,"chunks")).isEmpty());assertEquals(0,((Number)nativeField(out,"callbacks")).intValue());offset+=length;
            }
            assertEquals(acquired.get("checksum"),hash(assembled));
        }finally{Arrays.fill(assembled,(byte)0);}
    }
    /** AUTHORED_NOT_RUN. Requires a genuine signed v3 package and protected CHILD
     * context with an existing selection; the argument only skips missing setup.
     * This is a native lease/transaction oracle, with no renderer warmup claim. */
    @Test public void GenuineV3RestoreRemainsPendingAndReleasedStageKeepsPriorActiveObjects()throws Exception {
        org.junit.Assume.assumeTrue("NOT_RUN: separately prepared signed v3 and protected native fixture required",
            androidx.test.platform.app.InstrumentationRegistry.getArguments().getString("literaryChildCommon3dRestoreFixtureAvailable","").equals("true"));
        try(androidx.test.core.app.ActivityScenario<MainActivity> scenario=androidx.test.core.app.ActivityScenario.launch(MainActivity.class)) {
            java.util.concurrent.atomic.AtomicReference<PlanetChildVault.LocalV2AppOwner> original=new java.util.concurrent.atomic.AtomicReference<>();
            scenario.onActivity(activity->{try{Object plugin=activity.getBridge().getPlugin("PlanetChild").getInstance();original.set((PlanetChildVault.LocalV2AppOwner)nativeField(plugin,"owner"));}catch(Exception failure){throw new AssertionError(failure);}});
            PlanetChildVault.LocalV2AppOwner owner=original.get();assertNotNull(owner);Object context=nativeField(owner,"context");Map<String,Object> admitted;
            if(context==null)admitted=nativeCall(owner,"bootstrap",map("version",2L,"requestId",UUID.randomUUID().toString().replace("-","")));
            else admitted=nativeCall(owner,"readContext",nativeRequest((String)nativeField(context,"token")));
            assertEquals("Independently admitted original CHILD context required","child",admitted.get("status"));String token=(String)nativeRow(admitted.get("context")).get("token");
            Map<String,Object> stored=nativeData(owner,"readSceneSelection",nativeRequest(token));assertNotNull(stored.get("selection"));long revision=((Number)stored.get("revision")).longValue();
            PlanetChildAppearance.Selection expected=PlanetChildAppearance.decodeDTO(stored.get("selection"));
            Map<String,Object> restore=nativeRequest(token);restore.put("expectedRevision",revision);Map<String,Object> first=nativeData(owner,"restoreSceneSelection",restore);
            assertEquals("restored",first.get("status"));assertEquals(revision,((Number)first.get("revision")).longValue());Map<String,Object> scene=nativeRow(first.get("scene"));assertNotNull(scene.get("modelPackage"));String active=(String)scene.get("sceneToken");
            Map<String,Object> legacySkin=null;for(String slot:Arrays.asList("skin","stand","background")){Map<String,Object> output=nativeAcquire(owner,token,active,slot,null);if(slot.equals("skin"))legacySkin=output;}assertNotNull(legacySkin);nativeUnavailableChunk(owner,token,active,(String)legacySkin.get("resourceToken"));
            List<PlanetChildModelImport.Binding> resources=PlanetChildModelImport.bindings(scene.get("modelPackage"));Set<String> acquired=new HashSet<>();
            List<Map<String,Object>> binaryOutputs=new ArrayList<>();PlanetChildModelImport.Binding stagedModel=null;for(String kind:Arrays.asList("model","buffer","texture"))for(PlanetChildModelImport.Binding r:resources)if(r.tier.equals("high")&&r.kind.equals(kind)&&acquired.add(r.assetId)){Map<String,Object> output=nativeAcquire(owner,token,active,kind,r);if(kind.equals("texture"))nativeUnavailableChunk(owner,token,active,(String)output.get("resourceToken"));else{binaryOutputs.add(output);nativeReadChunks(owner,token,active,output);}if(kind.equals("model")&&stagedModel==null)stagedModel=r;}assertNotNull(stagedModel);assertFalse(binaryOutputs.isEmpty());
            Map<String,Object> remember=nativeRequest(token);remember.put("sceneToken",active);remember.put("expectedRevision",revision);Map<String,Object> committed=nativeData(owner,"rememberSceneSelection",remember);
            revision++;assertEquals(revision,((Number)committed.get("revision")).longValue());assertEquals(expected,PlanetChildAppearance.decodeDTO(committed.get("selection")));assertEquals(active,nativeField(owner,"activeSceneToken"));
            Object activeLease=nativeRow(nativeField(owner,"scenes")).get(active),delivery=nativeField(activeLease,"delivery"),catalog=nativeField(delivery,"resourceCatalog");
            Map<String,Object> media=new LinkedHashMap<>(nativeRow(nativeField(delivery,"mediaAssets"))),scenes=new LinkedHashMap<>(nativeRow(nativeField(delivery,"sceneAssets")));
            restore=nativeRequest(token);restore.put("expectedRevision",revision);Map<String,Object> restored=nativeData(owner,"restoreSceneSelection",restore);assertEquals("restored",restored.get("status"));String staged=(String)nativeRow(restored.get("scene")).get("sceneToken");
            assertNotEquals(active,staged);assertEquals("Restore publication must not promote pending output",active,nativeField(owner,"activeSceneToken"));assertSame(catalog,nativeField(delivery,"resourceCatalog"));
            Map<String,Object> currentMedia=nativeRow(nativeField(delivery,"mediaAssets")),currentScenes=nativeRow(nativeField(delivery,"sceneAssets"));assertEquals(media.keySet(),currentMedia.keySet());assertEquals(scenes.keySet(),currentScenes.keySet());
            for(String id:media.keySet())assertSame(media.get(id),currentMedia.get(id));for(String id:scenes.keySet())assertSame(scenes.get(id),currentScenes.get(id));
            nativeUnavailableChunk(owner,token,staged,(String)binaryOutputs.get(0).get("resourceToken"));nativeReadChunks(owner,token,active,binaryOutputs.get(0));
            Map<String,Object> stagedOutput=nativeAcquire(owner,token,staged,"model",stagedModel);nativeReadChunks(owner,token,staged,stagedOutput);PlanetChildWebResources.Output retiredOutput=(PlanetChildWebResources.Output)nativeRow(nativeField(owner,"webOutputs")).get(stagedOutput.get("resourceToken"));assertNotNull(retiredOutput);
            Map<String,Object> release=nativeRequest(token);release.put("sceneToken",staged);assertEquals("retired",nativeData(owner,"releaseScene",release).get("status"));
            assertEquals(active,nativeField(owner,"activeSceneToken"));assertSame(activeLease,nativeRow(nativeField(owner,"scenes")).get(active));assertEquals(Boolean.FALSE,nativeField(activeLease,"revoked"));
            assertTrue("Released stage joins and wipes authenticated Output",retiredOutput.knownClosed());nativeUnavailableChunk(owner,token,staged,(String)stagedOutput.get("resourceToken"));nativeReadChunks(owner,token,active,binaryOutputs.get(0));
            nativeAcquire(owner,token,active,"skin",null);
            Map<String,Object> open=nativeRequest(token);open.put("owner",scene.get("owner"));open.put("sceneId",scene.get("sceneId"));Map<String,Object> next=nativeData(owner,"openScene",open);assertEquals("opened",next.get("status"));
            assertEquals(active,nativeField(owner,"activeSceneToken"));assertSame(activeLease,nativeRow(nativeField(owner,"scenes")).get(active));
            release=nativeRequest(token);release.put("sceneToken",next.get("sceneToken"));nativeData(owner,"releaseScene",release);
            Map<String,Object> finalRead=nativeData(owner,"readSceneSelection",nativeRequest(token));assertEquals(revision,((Number)finalRead.get("revision")).longValue());assertEquals(expected,PlanetChildAppearance.decodeDTO(finalRead.get("selection")));
            // A second complete native stage receives a one-use prior snapshot
            // from the original store CAS, then restores the retained prior lease.
            open=nativeRequest(token);open.put("owner",scene.get("owner"));open.put("sceneId",scene.get("sceneId"));Map<String,Object> replacement=nativeData(owner,"openScene",open);String rollbackScene=(String)replacement.get("sceneToken");
            for(String slot:Arrays.asList("skin","stand","background"))nativeAcquire(owner,token,rollbackScene,slot,null);
            Set<String> rollbackAcquired=new HashSet<>();for(String kind:Arrays.asList("model","buffer","texture"))for(PlanetChildModelImport.Binding resource:resources)if(resource.tier.equals("high")&&resource.kind.equals(kind)&&rollbackAcquired.add(resource.assetId))nativeAcquire(owner,token,rollbackScene,kind,resource);
            Map<String,Object> replacementSave=nativeRequest(token);replacementSave.put("sceneToken",rollbackScene);replacementSave.put("expectedRevision",revision);Map<String,Object> newlySaved=nativeData(owner,"rememberSceneSelection",replacementSave);assertEquals(revision+1,((Number)newlySaved.get("revision")).longValue());assertEquals(rollbackScene,nativeField(owner,"activeSceneToken"));
            Object receiptLease=nativeRow(nativeField(owner,"scenes")).get(rollbackScene);assertEquals(Boolean.TRUE,nativeField(receiptLease,"rollbackCaptured"));assertEquals(active,nativeField(receiptLease,"rollbackPreviousToken"));assertEquals(Boolean.FALSE,nativeField(receiptLease,"rollbackConsumed"));
            Map<String,Object> rollback=nativeRequest(token);rollback.put("sceneToken",rollbackScene);rollback.put("expectedRevision",revision+1);Map<String,Object> rolledBack=nativeData(owner,"rollbackSceneSelection",rollback);assertEquals(revision+2,((Number)rolledBack.get("revision")).longValue());assertEquals(expected,PlanetChildAppearance.decodeDTO(rolledBack.get("selection")));assertEquals(active,nativeField(owner,"activeSceneToken"));assertEquals(Boolean.TRUE,nativeField(receiptLease,"rollbackConsumed"));assertEquals(Boolean.FALSE,nativeField(receiptLease,"rollbackArmed"));
            release=nativeRequest(token);release.put("sceneToken",rollbackScene);nativeData(owner,"releaseScene",release);assertSame(activeLease,nativeRow(nativeField(owner,"scenes")).get(active));nativeReadChunks(owner,token,active,binaryOutputs.get(0));
        }
    }
    @Test public void NativeActualWorldPositionsMustFitSignedBoundsAndCacheFraming()throws Exception {
        byte[] bytes=model(false),buffer=mesh();
        PlanetChildModelImport.Layout valid=PlanetChildModelImport.importModel(bytes,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1,new double[]{2,0,0},new double[]{3,1,0});valid.decode("mesh.bin",buffer);
        PlanetChildModelImport.Layout narrow=PlanetChildModelImport.importModel(bytes,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1,new double[]{2,0,0},new double[]{2.5,1,0});denied(()->narrow.decode("mesh.bin",buffer));
        String text=new String(bytes,StandardCharsets.UTF_8);
        byte[] nested=text.replace("\"nodes\":[{\"mesh\":0}]","\"nodes\":[{\"translation\":[10,0,0],\"children\":[1]},{\"mesh\":0,\"translation\":[1,0,0]}]").getBytes(StandardCharsets.UTF_8);
        PlanetChildModelImport.Layout overflow=importer(nested);denied(()->overflow.decode("mesh.bin",buffer));
        byte[] rotated=text.replace("\"mesh\":0}","\"mesh\":0,\"rotation\":[0,0,0.7071067811865476,0.7071067811865476]}").getBytes(StandardCharsets.UTF_8);
        PlanetChildModelImport.importModel(rotated,"model/gltf+json",Collections.singletonMap("mesh.bin",42),Collections.emptySet(),4096,1,new double[]{-1,2,0},new double[]{0,3,0}).decode("mesh.bin",buffer);
        byte[] raw=model(true);raw=new String(raw,StandardCharsets.UTF_8).replace("\"mesh\":0}","\"mesh\":0,\"translation\":[11,0,0]}").getBytes(StandardCharsets.UTF_8);
        int jsonLength=(raw.length+3)&~3;ByteBuffer glb=ByteBuffer.allocate(28+jsonLength+44).order(ByteOrder.LITTLE_ENDIAN);glb.putInt(0x46546c67).putInt(2).putInt(glb.capacity()).putInt(jsonLength).putInt(0x4e4f534a).put(raw);while(glb.position()<20+jsonLength)glb.put((byte)32);glb.putInt(44).putInt(0x004e4942).put(buffer);while(glb.hasRemaining())glb.put((byte)0);
        denied(()->PlanetChildModelImport.preflight(glb.array(),"model/gltf-binary"));
    }
    @SuppressWarnings("unchecked") @Test public void NativeWebpMaterialIsEconomyOnly()throws Exception {
        Map<String,Object> p=pack();List<?> tiers=(List<?>)p.get("tiers");
        Map<String,Object> high=(Map<String,Object>)tiers.get(0),model=(Map<String,Object>)((List<?>)high.get("models")).get(0);Object prior=model.get("dependencies");
        List<Object> dependencies=new ArrayList<>((List<Object>)prior);dependencies.add(resource("fallback-texture","texture","fallback.webp","image/webp",new byte[]{1}));model.put("dependencies",dependencies);denied(()->PlanetChildModelImport.bindings(p));model.put("dependencies",prior);
        // The synthetic pack reuses one descriptor across tiers, so clone the
        // Economy descriptor before checking the permitted fallback boundary.
        Map<String,Object> economy=(Map<String,Object>)tiers.get(2),economyModel=new LinkedHashMap<>(model);economyModel.put("dependencies",dependencies);economy.put("models",Collections.singletonList(economyModel));assertFalse(PlanetChildModelImport.bindings(p).isEmpty());
    }
    @Test public void NativeRollbackWireAcceptsOnlyOriginalSceneAndExpectedRevision()throws Exception {
        Map<String,Object> r=map("version",2L,"requestId","1".repeat(32),"contextToken","2".repeat(32),"sceneToken","3".repeat(32),"expectedRevision",1L);
        PlanetChildDataTransport.V2Request q=PlanetChildDataTransport.decodeV2("rollbackSceneSelection",r);assertEquals(1,q.expectedRevision);assertEquals(r.get("sceneToken"),q.sceneToken);
        for(String field:Arrays.asList("selection","previousSelection","priorRevision","profileId","owner","resourceToken","approved")){r.put(field,null);denied(()->PlanetChildDataTransport.decodeV2("rollbackSceneSelection",r));r.remove(field);}
        for(Object value:Arrays.asList(-1L,9007199254740990L,Double.NaN,-0.0d,0.5d,"1",null)){r.put("expectedRevision",value);denied(()->PlanetChildDataTransport.decodeV2("rollbackSceneSelection",r));}
        assertNotNull(PlanetChildPlugin.class.getDeclaredMethod("rollbackSceneSelection",com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));
    }
}
