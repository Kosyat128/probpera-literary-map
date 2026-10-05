package ru.probpera.literaryplanet;

import android.content.Context;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** AUTHORED_NOT_RUN, Android compilation also NOT_RUN. Mechanical cases use
 * exact production codecs and an explicit isolated AES namespace. Positive
 * original native cases require separately prepared signed package/media/scene
 * fixtures and a genuinely protected child record. SKIP is not acceptance.
 * Locale process phases require the original guardian Gate to have approved
 * the protected transition; no fixture, bool or saved reference grants it. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildAppearanceRuntimeTest {
    private android.os.Bundle args;private Context context;
    @Before public void ownRun(){args=InstrumentationRegistry.getArguments();assertEquals("local-v2-profile-appearance",args.getString("literaryChildAppearancePhase"));assertTrue(args.getString("literaryRunId","").matches("[a-f0-9]{32}"));context=InstrumentationRegistry.getInstrumentation().getTargetContext();}
    interface Attempt {void run() throws Exception;}
    private static void denied(Attempt action) throws Exception {try{action.run();fail("Expected native refusal");}catch(PlanetChildDataStore.Unavailable|PlanetChildVault.Unavailable expected){}}
    private static String id(){return UUID.randomUUID().toString().replace("-","");}
    private static Map<String,Object> map(Object... fields){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<fields.length;i+=2)out.put((String)fields[i],fields[i+1]);return out;}
    private static Map<String,Object> base(String token){return map("version",2L,"requestId",id(),"contextToken",token);}
    private static Object field(Object value,String name) throws Exception {Field field=value.getClass().getDeclaredField(name);field.setAccessible(true);return field.get(value);}
    private static long revision(Object value){assertTrue(value instanceof Number);double number=((Number)value).doubleValue();assertTrue(Double.isFinite(number)&&number==Math.rint(number)&&number>=0&&number<PlanetChildAppearance.MAX_SAFE);return ((Number)value).longValue();}
    @SuppressWarnings("unchecked") private static Map<String,Object> row(Object value){assertTrue(value instanceof Map);return (Map<String,Object>)value;}
    private static Map<String,Object> data(Map<String,Object> reply){assertEquals("ok",reply.get("status"));return row(reply.get("value"));}
    @Test public void closedAppearanceWireDeniesCapabilitiesAndProfileOverride() throws Exception {
        Map<String,Object> read=base("2".repeat(32));assertEquals("readSceneSelection",PlanetChildDataTransport.decodeV2("readSceneSelection",read).method);
        Map<String,Object> remember=new LinkedHashMap<>(read);remember.put("sceneToken","3".repeat(32));remember.put("expectedRevision",0L);assertEquals("3".repeat(32),PlanetChildDataTransport.decodeV2("rememberSceneSelection",remember).sceneToken);
        for(String key:Arrays.asList("selection","profileId","owner","policy","approval","acknowledged","receipt","uri","signature","nativeAuthority")){Map<String,Object> bad=new LinkedHashMap<>(remember);bad.put(key,true);denied(()->PlanetChildDataTransport.decodeV2("rememberSceneSelection",bad));}
        for(Object n:Arrays.asList(true,-1L,-0.0d,0.5d,Double.NaN,Double.POSITIVE_INFINITY,9007199254740990L,9007199254740991L)){Map<String,Object> bad=new LinkedHashMap<>(remember);bad.put("expectedRevision",n);denied(()->PlanetChildDataTransport.decodeV2("rememberSceneSelection",bad));}
        Map<String,Object> restore=new LinkedHashMap<>(read);restore.put("expectedRevision",9007199254740990L);assertEquals(9007199254740990L,PlanetChildDataTransport.decodeV2("restoreSceneSelection",restore).expectedRevision);restore.put("selection",PlanetChildDataStore.fixtureAppearanceSelection("one").dto());denied(()->PlanetChildDataTransport.decodeV2("restoreSceneSelection",restore));
        for(String method:Arrays.asList("readSceneSelection","rememberSceneSelection","restoreSceneSelection"))assertNotNull(PlanetChildPlugin.class.getDeclaredMethod(method,com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));
    }
    @Test public void typedStableReferencesAndRevisionsRemainBounded() throws Exception {
        PlanetChildAppearance.Selection value=PlanetChildDataStore.fixtureAppearanceSelection("one");byte[] encoded=value.encode();try{assertEquals(value,PlanetChildAppearance.decode(encoded));assertEquals(value,PlanetChildAppearance.decodeDTO(value.dto()));byte[] extra=Arrays.copyOf(encoded,encoded.length+1);try{denied(()->PlanetChildAppearance.decode(extra));}finally{Arrays.fill(extra,(byte)0);}}finally{Arrays.fill(encoded,(byte)0);}
        for(String capability:Arrays.asList("sceneToken","resourceToken","uri","deadline","remainingLifetimeMs","reviewKey","reviewReceipt","signature","rightsApproved","childSafe","policyGrant","packagePermit","texture","title","mediaBytes","contentChecksum")){Map<String,Object> bad=new LinkedHashMap<>(value.dto());bad.put(capability,true);denied(()->PlanetChildAppearance.decodeDTO(bad));}
        for(Object version:Arrays.asList(true,0L,2L,1.0d)){Map<String,Object> bad=new LinkedHashMap<>(value.dto());bad.put("schemaVersion",version);denied(()->PlanetChildAppearance.decodeDTO(bad));}
        Map<String,Object> wrongId=new LinkedHashMap<>(value.dto());wrongId.put("sceneId","../scene");denied(()->PlanetChildAppearance.decodeDTO(wrongId));Map<String,Object> wrongOwner=new LinkedHashMap<>(value.dto());wrongOwner.put("owner",map("kind","external-link","id","fixture-writer"));denied(()->PlanetChildAppearance.decodeDTO(wrongOwner));
        Map<String,Object> wrongGeometry=new LinkedHashMap<>(value.dto());wrongGeometry.put("stand",map("geometryId","adult.custom","assetId","fixture-stand","entityId","fixture-stand-entity"));denied(()->PlanetChildAppearance.decodeDTO(wrongGeometry));
        Map<String,Object> collision=new LinkedHashMap<>(value.dto());collision.put("background",map("geometryId","background.base.library","assetId",value.skin.assetId,"entityId","fixture-background-entity"));denied(()->PlanetChildAppearance.decodeDTO(collision));
        assertEquals(8L,PlanetChildAppearance.next(7));denied(()->PlanetChildAppearance.next(9007199254740990L));denied(()->PlanetChildAppearance.revision(9007199254740991L));denied(()->PlanetChildAppearance.revision(-1));
    }
    @Test public void legacyAndInactiveAppearanceSnapshotsRemainExact() throws Exception {
        for(String scenario:Arrays.asList("legacy","cas","isolation","tombstone","migration","corrupt"))assertTrue(scenario,PlanetChildDataStore.fixtureAppearanceScenario(context,scenario));
    }
    @Test public void encryptedAppearancePersistsAcrossReopenWithoutImplicitSeed() throws Exception {
        assertTrue(PlanetChildDataStore.fixtureAppearanceMissingDoesNotSeed(context,id()));
        String phase=args.getString("literaryChildAppearancePersistencePhase","");Assume.assumeTrue("NOT_RUN: explicit owned AES write/read/pending process phase required",Arrays.asList("write","read","pending","pending-reopen").contains(phase));
        assertTrue(PlanetChildDataStore.fixtureAppearancePersistence(context,args.getString("literaryRunId"),phase));
        if("write".equals(phase)||"read".equals(phase))assertTrue("A second native store instance decrypts exact stable references",PlanetChildDataStore.fixtureAppearancePersistence(context,args.getString("literaryRunId"),"read"));
        if("pending".equals(phase)||"pending-reopen".equals(phase))assertTrue("Unknown deny marker persists through another native instance",PlanetChildDataStore.fixtureAppearancePersistence(context,args.getString("literaryRunId"),"pending-reopen"));
    }
    private static final class Pending {
        final CountDownLatch returned=new CountDownLatch(1);final AtomicReference<Map<String,Object>> reply=new AtomicReference<>();
        private Pending(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request) throws Exception {PlanetChildDataTransport.V2Request dto=PlanetChildDataTransport.decodeV2(method,request);InstrumentationRegistry.getInstrumentation().runOnMainSync(()->owner.execute(dto,value->{reply.set(value);returned.countDown();}));}
        Map<String,Object> joined() throws Exception {assertTrue("Original actual native request joined",returned.await(10,TimeUnit.SECONDS));assertNotNull(reply.get());return reply.get();}
    }
    private static Map<String,Object> invoke(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request) throws Exception {return new Pending(owner,method,request).joined();}
    private static PlanetChildVault.LocalV2AppOwner owner(ActivityScenario<MainActivity> scenario) throws Exception {
        AtomicReference<PlanetChildVault.LocalV2AppOwner> original=new AtomicReference<>();scenario.onActivity(activity->{try{Object plugin=activity.getBridge().getPlugin("PlanetChild").getInstance();original.set((PlanetChildVault.LocalV2AppOwner)field(plugin,"owner"));}catch(Exception failure){throw new AssertionError(failure);}});assertNotNull(original.get());return original.get();
    }
    private static Map<String,Object> current(PlanetChildVault.LocalV2AppOwner owner) throws Exception {
        Object current=field(owner,"context");Map<String,Object> reply=current==null?invoke(owner,"bootstrap",map("version",2L,"requestId",id())):invoke(owner,"readContext",base((String)field(current,"token")));assertEquals("Actual independently admitted native CHILD context required","child",reply.get("status"));return row(reply.get("context"));
    }
    private Map<String,Object> fixture() throws Exception {
        try(InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("child-appearance-runtime-fixture-v1.json")){byte[] buffer=new byte[65536];int used=0;try{while(used<buffer.length){int n=input.read(buffer,used,buffer.length-used);if(n<0)break;assertTrue(n>0);used+=n;}assertTrue(used>0);assertEquals(-1,input.read());org.json.JSONObject object=new org.json.JSONObject(new String(buffer,0,used,StandardCharsets.UTF_8));Map<String,Object> result=PlanetChildDataTransport.ownV2DTO(object);assertEquals(new HashSet<>(Arrays.asList("owner","sceneId","profileId")),result.keySet());PlanetChildAppearance.identifier((String)result.get("sceneId"));PlanetChildAppearance.identifier((String)result.get("profileId"));return result;}finally{Arrays.fill(buffer,(byte)0);}}
    }
    private static PlanetChildAppearance.Selection projection(Map<String,Object> scene) throws Exception {
        Map<String,Object> owner=row(scene.get("owner")),skin=row(scene.get("skin")),stand=row(scene.get("stand")),background=row(scene.get("background")),skinEntity=row(skin.get("entity")),standAsset=row(stand.get("asset")),backgroundAsset=row(background.get("asset"));
        Map<String,Object> standEntity=row(standAsset.get("entity")),backgroundEntity=row(backgroundAsset.get("entity"));assertEquals("skin",skinEntity.get("kind"));assertEquals("stand",standEntity.get("kind"));assertEquals("background",backgroundEntity.get("kind"));
        return new PlanetChildAppearance.Selection((String)scene.get("sceneId"),new PlanetChildAppearance.Owner((String)owner.get("kind"),(String)owner.get("id")),new PlanetChildAppearance.Slot((String)skin.get("assetId"),(String)skinEntity.get("id")),new PlanetChildAppearance.Geometry((String)stand.get("geometryId"),(String)standAsset.get("assetId"),(String)standEntity.get("id")),new PlanetChildAppearance.Geometry((String)background.get("geometryId"),(String)backgroundAsset.get("assetId"),(String)backgroundEntity.get("id")));
    }
    @Test public void nativeSceneAuthorityAndFreshRestoreRemainRequired() throws Exception {
        for(Constructor<?> ctor:PlanetChildVault.LocalV2SceneSelectionPermit.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(ctor.getModifiers()));for(Method method:PlanetChildVault.LocalV2SceneSelectionPermit.class.getDeclaredMethods())if(Modifier.isStatic(method.getModifiers()))assertTrue("No public native permit maker",Modifier.isPrivate(method.getModifiers()));
        String late=args.getString("literaryChildAppearanceLateAckPhase","");if(Arrays.asList("readback","post-completion","post-handoff").contains(late)){Assume.assumeTrue("NOT_RUN: separate genuine native terminal unknown fixture required",args.getString("literaryChildAppearanceLateAckFixtureAvailable","").equals("true"));lateAck(late);return;}
        Assume.assumeTrue("Production empty-pin denial is a distinct target",!args.getString("literaryChildAppearanceFixtureAvailable","").equals("true"));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner original=owner(scenario);Map<String,Object> read=base("2".repeat(32));assertNotEquals("ok",invoke(original,"readSceneSelection",read).get("status"));Map<String,Object> remember=base("2".repeat(32));remember.put("sceneToken","3".repeat(32));remember.put("expectedRevision",0L);assertNotEquals("ok",invoke(original,"rememberSceneSelection",remember).get("status"));Map<String,Object> restore=base("2".repeat(32));restore.put("expectedRevision",0L);assertNotEquals("ok",invoke(original,"restoreSceneSelection",restore).get("status"));}
    }
    private void lateAck(String phase) throws Exception {
        Map<String,Object> fixture=fixture();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner original=owner(scenario);Map<String,Object> nativeContext=current(original);String token=(String)nativeContext.get("token");Map<String,Object> prior=data(invoke(original,"readSceneSelection",base(token)));assertEquals(fixture.get("profileId"),prior.get("profileId"));Map<String,Object> open=base(token);open.put("owner",fixture.get("owner"));open.put("sceneId",fixture.get("sceneId"));Map<String,Object> scene=data(invoke(original,"openScene",open));assertEquals("opened",scene.get("status"));String sceneToken=(String)scene.get("sceneToken"),command=id();
            if("post-handoff".equals(phase))PlanetChildAppearance.RuntimeDelay.armHandoff(context,command);else if("post-completion".equals(phase))PlanetChildAppearance.RuntimeDelay.armCompletion(context,command);else PlanetChildAppearance.RuntimeDelay.arm(context,command);
            try{Map<String,Object> remember=base(token);remember.put("requestId",command);remember.put("sceneToken",sceneToken);remember.put("expectedRevision",revision(prior.get("revision")));Pending pending=new Pending(original,"rememberSceneSelection",remember);long began=android.os.SystemClock.elapsedRealtime();while(!PlanetChildAppearance.RuntimeDelay.entered(command)){assertTrue("Actual native barrier entered",android.os.SystemClock.elapsedRealtime()-began<3000);Thread.sleep(10);}
                assertTrue("Durable marker remains through readback, completed command and actual consumer handoff barriers",PlanetChildDataStore.fixtureProductionAppearancePending(context,command));
                Map<String,Object> retire=base(token);retire.put("sceneToken",sceneToken);Pending retirement=new Pending(original,"releaseScene",retire);
                Map<?,?> leases=(Map<?,?>)field(original,"scenes");Object lease=leases.get(sceneToken);assertTrue("Actual native original scene synchronously loses authority",lease==null||Boolean.TRUE.equals(field(lease,"revoked")));
                PlanetChildAppearance.RuntimeDelay.resume(command);assertNotEquals("Unknown acknowledgement cannot publish saved", "ok",pending.joined().get("status"));retirement.joined();assertTrue("Sticky native pending survives failed native completion",PlanetChildDataStore.fixtureProductionAppearancePending(context,command));
            }finally{PlanetChildAppearance.RuntimeDelay.resume(command);}
        }
    }
    @Test public void genuineAppearanceRestoreKeepsTriadAcrossContextRestartAndAllowedLocale() throws Exception {
        Assume.assumeTrue("NOT_RUN: real separately staged signed native fixture and protected record required",args.getString("literaryChildAppearanceFixtureAvailable","").equals("true"));String phase=args.getString("literaryChildAppearanceProcessPhase","");Assume.assumeTrue("NOT_RUN: explicit select-ru / guardian-approved restore-en / restore-ru process phase required",Arrays.asList("select-ru","restore-en","restore-ru").contains(phase));
        Map<String,Object> fixture=fixture();try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){PlanetChildVault.LocalV2AppOwner original=owner(scenario);Map<String,Object> nativeContext=current(original);String token=(String)nativeContext.get("token"),locale="restore-en".equals(phase)?"en":"ru";assertEquals("Locale is read from genuine fresh native admission",locale,nativeContext.get("locale"));
            Map<String,Object> read=data(invoke(original,"readSceneSelection",base(token)));assertEquals(fixture.get("profileId"),read.get("profileId"));PlanetChildAppearance.Selection expected;long next;String predecessor=null;
            if("select-ru".equals(phase)){Map<String,Object> open=base(token);open.put("owner",fixture.get("owner"));open.put("sceneId",fixture.get("sceneId"));Map<String,Object> scene=data(invoke(original,"openScene",open));assertEquals("opened",scene.get("status"));expected=projection(scene);predecessor=(String)scene.get("sceneToken");Map<String,Object> remember=base(token);remember.put("sceneToken",predecessor);remember.put("expectedRevision",revision(read.get("revision")));Map<String,Object> saved=data(invoke(original,"rememberSceneSelection",remember));next=revision(read.get("revision"))+1;assertEquals(next,revision(saved.get("revision")));assertEquals(expected,PlanetChildAppearance.decodeDTO(saved.get("selection")));}
            else{assertNotNull("Earlier owned process choice must exist",read.get("selection"));expected=PlanetChildAppearance.decodeDTO(read.get("selection"));next=revision(read.get("revision"));}
            assertEquals(fixture.get("sceneId"),expected.sceneId);Map<String,Object> fixtureOwner=row(fixture.get("owner"));assertEquals(fixtureOwner.get("kind"),expected.owner.kind);assertEquals(fixtureOwner.get("id"),expected.owner.id);
            assertEquals("retired",invoke(original,"retire",base(token)).get("status"));Map<String,Object> successor=current(original);String fresh=(String)successor.get("token");assertNotEquals(token,fresh);assertEquals(locale,successor.get("locale"));Map<String,Object> reread=data(invoke(original,"readSceneSelection",base(fresh)));assertEquals(fixture.get("profileId"),reread.get("profileId"));assertEquals(next,revision(reread.get("revision")));assertEquals(expected,PlanetChildAppearance.decodeDTO(reread.get("selection")));
            Map<String,Object> restore=base(fresh);restore.put("expectedRevision",next);Map<String,Object> restored=data(invoke(original,"restoreSceneSelection",restore));assertEquals("restored",restored.get("status"));assertEquals(next,revision(restored.get("revision")));assertEquals(expected,PlanetChildAppearance.decodeDTO(restored.get("selection")));Map<String,Object> scene=row(restored.get("scene"));assertEquals(expected,projection(scene));String restoredToken=(String)scene.get("sceneToken");assertNotEquals(predecessor,restoredToken);
            Set<Object> resources=new HashSet<>();for(String slot:Arrays.asList("skin","stand","background")){Map<String,Object> request=base(fresh);request.put("sceneToken",restoredToken);request.put("slotId",slot);Map<String,Object> acquired=data(invoke(original,"acquireWebResource",request));assertEquals("available",acquired.get("status"));assertTrue(resources.add(acquired.get("resourceToken")));assertEquals(restoredToken,acquired.get("sceneToken"));String asset="skin".equals(slot)?expected.skin.assetId:"stand".equals(slot)?expected.stand.assetId:expected.background.assetId;assertEquals(asset,acquired.get("assetId"));Map<String,Object> release=base(fresh);release.put("resourceToken",acquired.get("resourceToken"));assertEquals("retired",data(invoke(original,"releaseWebResource",release)).get("status"));}
            Map<String,Object> release=base(fresh);release.put("sceneToken",restoredToken);assertEquals("retired",data(invoke(original,"releaseScene",release)).get("status"));assertTrue(((Map<?,?>)field(original,"webOutputs")).isEmpty());Map<String,Object> finalRead=data(invoke(original,"readSceneSelection",base(fresh)));assertEquals(next,revision(finalRead.get("revision")));assertEquals(expected,PlanetChildAppearance.decodeDTO(finalRead.get("selection")));
            Map<String,Object> stale=base(fresh);stale.put("sceneToken",restoredToken);stale.put("expectedRevision",next);assertNotEquals("Retired scene cannot save again","ok",invoke(original,"rememberSceneSelection",stale).get("status"));
        }
    }
}
