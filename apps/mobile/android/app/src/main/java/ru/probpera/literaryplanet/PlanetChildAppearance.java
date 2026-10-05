package ru.probpera.literaryplanet;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Independently versioned stable data only. No digest, URI, review, token,
 * bytes or saved approval can enter this codec or become native authority. */
final class PlanetChildAppearance {
    static final long MAX_SAFE=9007199254740991L;
    static final int MAX_BYTES=2048;
    private static final Set<String> OWNERS=Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
        "country","writer","biography","work","character","storyworld","fact","quote","activity","quiz",
        "search-result","recommendation","favorite","recent","offline-package","deep-link")));
    private PlanetChildAppearance() {}
    private static void require(boolean value) throws PlanetChildDataStore.Unavailable { if(!value)throw new PlanetChildDataStore.Unavailable(); }
    static String identifier(String value) throws Exception {require(value!=null&&value.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,95}"));return value;}
    static void revision(long value) throws Exception {require(value>=0&&value<MAX_SAFE);}
    static long next(long value) throws Exception {require(value>=0&&value<MAX_SAFE-1);return value+1;}
    static final class Owner {
        final String kind,id;
        Owner(String kind,String id) throws Exception {require(OWNERS.contains(kind));this.kind=kind;this.id=identifier(id);}
    }
    static final class Slot {
        final String assetId,entityId;
        Slot(String assetId,String entityId) throws Exception {this.assetId=identifier(assetId);this.entityId=identifier(entityId);}
    }
    static final class Geometry {
        final String geometryId,assetId,entityId;
        Geometry(String geometryId,String assetId,String entityId) throws Exception {this.geometryId=identifier(geometryId);this.assetId=identifier(assetId);this.entityId=identifier(entityId);}
    }
    static final class Selection {
        final String sceneId;final Owner owner;final Slot skin;final Geometry stand,background;
        Selection(String sceneId,Owner owner,Slot skin,Geometry stand,Geometry background) throws Exception {
            require(owner!=null&&skin!=null&&stand!=null&&background!=null
                &&"stand.base.child-book-cloud".equals(stand.geometryId)&&"background.base.library".equals(background.geometryId)&&new HashSet<>(Arrays.asList(skin.assetId,stand.assetId,background.assetId)).size()==3);
            this.sceneId=identifier(sceneId);this.owner=owner;this.skin=skin;this.stand=stand;this.background=background;
        }
        Map<String,Object> dto() {return row("schemaVersion",1L,"sceneId",sceneId,"owner",row("kind",owner.kind,"id",owner.id),
            "skin",row("assetId",skin.assetId,"entityId",skin.entityId),
            "stand",row("geometryId",stand.geometryId,"assetId",stand.assetId,"entityId",stand.entityId),
            "background",row("geometryId",background.geometryId,"assetId",background.assetId,"entityId",background.entityId));}
        byte[] encode() throws Exception {
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream out=new DataOutputStream(bytes);
            out.writeInt(0x4c505331);out.writeByte(1);
            for(String value:new String[]{sceneId,owner.kind,owner.id,skin.assetId,skin.entityId,stand.geometryId,stand.assetId,stand.entityId,background.geometryId,background.assetId,background.entityId})writeText(out,value);
            out.flush();byte[] result=bytes.toByteArray();require(result.length<=MAX_BYTES);return result;
        }
        @Override public boolean equals(Object raw) {if(!(raw instanceof Selection))return false;Selection s=(Selection)raw;return sceneId.equals(s.sceneId)&&owner.kind.equals(s.owner.kind)&&owner.id.equals(s.owner.id)
            &&skin.assetId.equals(s.skin.assetId)&&skin.entityId.equals(s.skin.entityId)&&stand.geometryId.equals(s.stand.geometryId)&&stand.assetId.equals(s.stand.assetId)&&stand.entityId.equals(s.stand.entityId)
            &&background.geometryId.equals(s.background.geometryId)&&background.assetId.equals(s.background.assetId)&&background.entityId.equals(s.background.entityId);}
        @Override public int hashCode(){return Objects.hash(sceneId,owner.kind,owner.id,skin.assetId,skin.entityId,stand.geometryId,stand.assetId,stand.entityId,background.geometryId,background.assetId,background.entityId);}
    }
    private static Map<String,Object> row(Object... fields){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)out.put((String)fields[i],fields[i+1]);return Collections.unmodifiableMap(out);}
    private static void writeText(DataOutputStream out,String value) throws Exception {byte[] bytes=value.getBytes(StandardCharsets.UTF_8);try{require(bytes.length>0&&bytes.length<=96);out.writeShort(bytes.length);out.write(bytes);}finally{Arrays.fill(bytes,(byte)0);}}
    private static String readText(DataInputStream in) throws Exception {int length=in.readUnsignedShort();require(length>0&&length<=96&&length<=in.available());byte[] bytes=new byte[length];try{in.readFully(bytes);return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}finally{Arrays.fill(bytes,(byte)0);}}
    static Selection decode(byte[] bytes) throws Exception {
        require(bytes!=null&&bytes.length>0&&bytes.length<=MAX_BYTES);DataInputStream in=new DataInputStream(new ByteArrayInputStream(bytes));require(in.readInt()==0x4c505331&&in.readUnsignedByte()==1);
        String scene=readText(in);Owner owner=new Owner(readText(in),readText(in));Slot skin=new Slot(readText(in),readText(in));Geometry stand=new Geometry(readText(in),readText(in),readText(in)),background=new Geometry(readText(in),readText(in),readText(in));
        require(in.available()==0);Selection result=new Selection(scene,owner,skin,stand,background);byte[] exact=result.encode();try{require(Arrays.equals(exact,bytes));}finally{Arrays.fill(exact,(byte)0);}return result;
    }
    private static Map<?,?> object(Object raw,String... fields) throws Exception {require(raw instanceof Map);Map<?,?> row=(Map<?,?>)raw;require(row.size()==fields.length&&row.keySet().equals(new HashSet<>(Arrays.asList(fields))));return row;}
    private static String text(Object raw) throws Exception {require(raw instanceof String);return (String)raw;}
    static Selection decodeDTO(Object raw) throws Exception {
        Map<?,?> root=object(raw,"schemaVersion","sceneId","owner","skin","stand","background");Object version=root.get("schemaVersion");require((version instanceof Integer||version instanceof Long)&&((Number)version).longValue()==1);
        Map<?,?> owner=object(root.get("owner"),"kind","id"),skin=object(root.get("skin"),"assetId","entityId"),stand=object(root.get("stand"),"geometryId","assetId","entityId"),background=object(root.get("background"),"geometryId","assetId","entityId");
        return new Selection(text(root.get("sceneId")),new Owner(text(owner.get("kind")),text(owner.get("id"))),new Slot(text(skin.get("assetId")),text(skin.get("entityId"))),new Geometry(text(stand.get("geometryId")),text(stand.get("assetId")),text(stand.get("entityId"))),new Geometry(text(background.get("geometryId")),text(background.get("assetId")),text(background.get("entityId"))));
    }
    /** Debug scheduling barrier pauses actual native post-readback work only;
     * it cannot construct a permit or authorize a command/acknowledgement. */
    static final class RuntimeDelay {
        private static final Map<String,Gate> GATES=new HashMap<>();
        private static final class Gate {boolean entered,resumed;final int stage;final android.content.Context context;private Gate(android.content.Context context,int stage){this.context=context;this.stage=stage;}}
        static synchronized void arm(android.content.Context context,String id) throws Exception {arm(context,id,0);} static synchronized void armCompletion(android.content.Context context,String id) throws Exception {arm(context,id,1);} static synchronized void armHandoff(android.content.Context context,String id) throws Exception {arm(context,id,2);} private static synchronized void arm(android.content.Context context,String id,int stage) throws Exception {require(context!=null);android.content.Context app=context.getApplicationContext();require(app!=null&&"ru.probpera.literaryplanet.dev".equals(app.getPackageName())&&(app.getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0&&id!=null&&id.matches("[a-f0-9]{32}")&&GATES.isEmpty());GATES.put(id,new Gate(app,stage));}
        static synchronized boolean entered(String id){Gate g=GATES.get(id);if(g==null)return false;synchronized(g){return g.entered;}}
        static void resume(String id){Gate g;synchronized(RuntimeDelay.class){g=GATES.remove(id);}if(g!=null)synchronized(g){g.resumed=true;g.notifyAll();}}
        static void hold(String id) throws Exception {hold(id,0);} static void holdCompletion(String id) throws Exception {hold(id,1);} static void holdHandoff(String id) throws Exception {hold(id,2);} private static void hold(String id,int stage) throws Exception {Gate g;synchronized(RuntimeDelay.class){g=GATES.get(id);}if(g==null||g.stage!=stage)return;require("ru.probpera.literaryplanet.dev".equals(g.context.getPackageName())&&(g.context.getApplicationInfo().flags&android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0&&android.os.Looper.myLooper()!=android.os.Looper.getMainLooper());long began=android.os.SystemClock.elapsedRealtime();synchronized(g){g.entered=true;g.notifyAll();while(!g.resumed){long now=android.os.SystemClock.elapsedRealtime();require(now>=began&&now-began<5000);g.wait(10);}}}
    }
}
