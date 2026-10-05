package ru.probpera.literaryplanet;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

/** Authored, NOT_RUN. Codec/denial cases do not grant admission. The positive
 * case requires a separately prepared signed local native fixture and a real
 * native protected child record. It exercises the ORIGINAL plugin owner/SDK,
 * original MainActivity WebView, real raster decode and WebGL upload. Skipping
 * that prerequisite is explicitly not a positive output/runtime claim. */
@RunWith(AndroidJUnit4.class)
public final class PlanetChildCanonicalResourceRuntimeTest {
    @Before public void ownRun(){android.os.Bundle args=InstrumentationRegistry.getArguments();assertEquals("local-v2-canonical-resource",args.getString("literaryChildCanonicalResourcePhase"));assertTrue(args.getString("literaryRunId","").matches("[a-f0-9]{32}"));}
    interface Attempt{void run()throws Exception;}
    static void denied(Attempt body)throws Exception{try{body.run();fail("Expected native unavailable");}catch(InvocationTargetException error){assertNotNull(error.getCause());}catch(PlanetChildVault.Unavailable|PlanetChildDataStore.Unavailable expected){}}
    static Map<String,Object> map(Object... values){Map<String,Object> out=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out;}
    static Map<String,Object> base(){return map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken","2".repeat(32));}
    static Map<String,Object> owner(){return map("kind","writer","id","fixture-writer","contentChecksum","a".repeat(64));}
    @Test public void closedWireRejectsCallerURLProofAndCleanupAcknowledgement()throws Exception {
        final Map<String,Object> openRequest=base();openRequest.put("owner",owner());openRequest.put("sceneId","fixture-scene");assertEquals("fixture-scene",PlanetChildDataTransport.decodeV2("openScene",openRequest).sceneId);
        for(String extra:Arrays.asList("uri","proof","gpuAck","clearReceipt","nativeAuthority")){openRequest.put(extra,true);denied(()->PlanetChildDataTransport.decodeV2("openScene",openRequest));openRequest.remove(extra);}
        Map<String,Object> request=base();request.put("sceneToken","3".repeat(32));request.put("slotId","skin");assertEquals("skin",PlanetChildDataTransport.decodeV2("acquireWebResource",request).slotId);
        final Map<String,Object> bad=request;for(String slot:Arrays.asList("image","accessory","../skin","skin?x")){bad.put("slotId",slot);denied(()->PlanetChildDataTransport.decodeV2("acquireWebResource",bad));}
    }
    @Test public void opaqueURIsAndNativeFactoriesRemainClosed()throws Exception {
        assertEquals("1".repeat(32),PlanetChildWebResources.token("planet-child-resource://local/"+"1".repeat(32)));
        for(String uri:Arrays.asList("planet-child-resource://local/"+"1".repeat(32)+"?q=1","planet-child-resource://local/"+"1".repeat(32)+"#a","planet-child-resource://local/"+"1".repeat(32)+"/x","planet-child-resource://other/"+"1".repeat(32),"https://localhost/"+"1".repeat(32)))denied(()->PlanetChildWebResources.token(uri));
        for(String method:Arrays.asList("listScenes","openScene","releaseScene","acquireWebResource","releaseWebResource"))assertNotNull(PlanetChildPlugin.class.getDeclaredMethod(method,com.getcapacitor.PluginCall.class).getAnnotation(com.getcapacitor.PluginMethod.class));
        for(Constructor<?> constructor:PlanetChildVault.LocalV2WebOutputPermit.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        for(Constructor<?> constructor:PlanetChildWebResources.Output.class.getDeclaredConstructors())assertTrue(Modifier.isPrivate(constructor.getModifiers()));
    }
    @Test public void sceneParserSupportsFractionsWithoutBroadeningOriginalPackageParser()throws Exception {
        Class<?> scene=Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2SceneJson"),original=Class.forName("ru.probpera.literaryplanet.PlanetChildVault$LocalV2PackageJson");
        Method parse=scene.getDeclaredMethod("read",byte[].class,int.class),legacy=original.getDeclaredMethod("read",byte[].class,int.class);parse.setAccessible(true);legacy.setAccessible(true);
        byte[] valid="{\"position\":[2,0.25,-1],\"radius\":0.05}".getBytes(java.nio.charset.StandardCharsets.UTF_8);assertNotNull(parse.invoke(null,valid,524288));denied(()->legacy.invoke(null,valid,524288));
        for(String bad:Arrays.asList("{\"x\":0,\"x\":1}","[NaN]","[1e999]","[-0.0]","[1.]"))denied(()->parse.invoke(null,bad.getBytes(java.nio.charset.StandardCharsets.UTF_8),524288));
    }
    private static final class Request implements android.webkit.WebResourceRequest {
        private final android.net.Uri uri;private final boolean main;
        Request(String uri,boolean main){this.uri=android.net.Uri.parse(uri);this.main=main;}
        public android.net.Uri getUrl(){return uri;}public boolean isForMainFrame(){return main;}public boolean isRedirect(){return false;}public boolean hasGesture(){return false;}
        public String getMethod(){return "GET";}public Map<String,String> getRequestHeaders(){return Collections.singletonMap("Origin",PlanetChildWebResources.ORIGIN);}
    }
    @Test public void realBoundWebViewDeniesUnknownWrongViewAndMainFrame()throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            AtomicReference<MainActivity> activity=new AtomicReference<>();AtomicReference<PlanetChildWebResources> handler=new AtomicReference<>();scenario.onActivity(value->{activity.set(value);try{handler.set(value.childWebResources());}catch(Exception error){throw new AssertionError(error);}});
            String uri="planet-child-resource://local/"+"1".repeat(32);assertEquals(403,handler.get().shouldInterceptRequest(handler.get().web(),new Request(uri,false)).getStatusCode());
            assertEquals(403,handler.get().shouldInterceptRequest(null,new Request(uri,false)).getStatusCode());assertEquals(403,handler.get().shouldInterceptRequest(handler.get().web(),new Request(uri,true)).getStatusCode());
        }
    }
    private static Map<String,Object> invoke(PlanetChildVault.LocalV2AppOwner owner,String method,Map<String,Object> request)throws Exception {
        CountDownLatch returned=new CountDownLatch(1);AtomicReference<Map<String,Object>> reply=new AtomicReference<>();PlanetChildDataTransport.V2Request dto=PlanetChildDataTransport.decodeV2(method,request);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->owner.execute(dto,value->{reply.set(value);returned.countDown();}));assertTrue("Actual native request join",returned.await(10,TimeUnit.SECONDS));assertNotNull(reply.get());return reply.get();
    }
    private static String js(MainActivity activity,String expression)throws Exception {
        CountDownLatch returned=new CountDownLatch(1);AtomicReference<String> reply=new AtomicReference<>();InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.getBridge().getWebView().evaluateJavascript(expression,value->{reply.set(value);returned.countDown();}));assertTrue(returned.await(5,TimeUnit.SECONDS));return reply.get();
    }
    @SuppressWarnings("unchecked") @Test public void genuineOriginalOutputDecodesUploadsAndRetiresAfterAcquisitionCommandReturned()throws Exception {
        Assume.assumeTrue("Requires separately signed native fixture; a skipped case is not acceptance","true".equals(InstrumentationRegistry.getArguments().getString("literaryCanonicalFixtureAvailable")));
        org.json.JSONObject fixture;try(java.io.InputStream input=InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("child-canonical-resource-runtime-fixture-v2.json")){java.io.ByteArrayOutputStream bounded=new java.io.ByteArrayOutputStream();byte[] scratch=new byte[4096];try{for(int n;(n=input.read(scratch))!=-1;){assertTrue(n>0&&bounded.size()+n<=65536);bounded.write(scratch,0,n);}}finally{Arrays.fill(scratch,(byte)0);}byte[] bytes=bounded.toByteArray();assertTrue(bytes.length>0&&bytes.length<=65536);try{fixture=new org.json.JSONObject(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));}finally{Arrays.fill(bytes,(byte)0);}}
        assertEquals(2,fixture.length());Map<String,Object> fixtureOwner=PlanetChildDataTransport.ownV2DTO(fixture.getJSONObject("owner"));String sceneId=fixture.getString("sceneId");
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            AtomicReference<MainActivity> activity=new AtomicReference<>();AtomicReference<PlanetChildVault.LocalV2AppOwner> original=new AtomicReference<>();scenario.onActivity(value->{activity.set(value);try{Object plugin=value.getBridge().getPlugin("PlanetChild").getInstance();Field field=PlanetChildPlugin.class.getDeclaredField("owner");field.setAccessible(true);original.set((PlanetChildVault.LocalV2AppOwner)field.get(plugin));}catch(Exception error){throw new AssertionError(error);}});assertNotNull(original.get());
            Map<String,Object> boot=invoke(original.get(),"bootstrap",map("version",2L,"requestId",UUID.randomUUID().toString().replace("-","")));assertEquals("Actual native fixture must be admitted","child",boot.get("status"));String context=(String)((Map<?,?>)boot.get("context")).get("token");
            Map<String,Object> opened=map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken",context,"owner",fixtureOwner,"sceneId",sceneId);
            Map<String,Object> scene=(Map<String,Object>)invoke(original.get(),"openScene",opened).get("value");assertEquals("opened",scene.get("status"));String sceneToken=(String)scene.get("sceneToken");
            Map<String,Object> acquired=map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken",context,"sceneToken",sceneToken,"slotId","skin");Map<String,Object> resource=(Map<String,Object>)invoke(original.get(),"acquireWebResource",acquired).get("value");assertEquals("available",resource.get("status"));String uri=(String)resource.get("uri");assertEquals(resource.get("resourceToken"),PlanetChildWebResources.token(uri));
            String script="(()=>{const image=new Image();window.__canonicalNativeFixture={state:'pending'};image.crossOrigin='anonymous';image.onerror=()=>{image.src='';window.__canonicalNativeFixture={state:'denied'};};image.onload=()=>{let gl,texture;try{if(image.naturalWidth!==2*image.naturalHeight)throw Error('ratio');const canvas=document.createElement('canvas');gl=canvas.getContext('webgl');if(!gl)throw Error('webgl');texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);if(gl.getError()!==gl.NO_ERROR)throw Error('upload');window.__canonicalNativeFixture={state:'uploaded',width:image.naturalWidth,height:image.naturalHeight};}catch(e){window.__canonicalNativeFixture={state:'denied'};}finally{image.onload=null;image.onerror=null;image.src='';if(gl&&texture)gl.deleteTexture(texture);if(gl){const loss=gl.getExtension('WEBGL_lose_context');if(loss)loss.loseContext();}}};image.src="+org.json.JSONObject.quote(uri)+";return 'started';})()";
            js(activity.get(),script);long deadline=android.os.SystemClock.elapsedRealtime()+5000;String result;do{result=js(activity.get(),"JSON.stringify(window.__canonicalNativeFixture)");if(result.contains("uploaded")||result.contains("denied"))break;Thread.sleep(20);}while(android.os.SystemClock.elapsedRealtime()<deadline);assertTrue("Actual WebView image decode and WebGL upload",result.contains("uploaded"));
            Map<String,Object> retired=map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken",context,"resourceToken",resource.get("resourceToken"));assertEquals("retired",((Map<?,?>)invoke(original.get(),"releaseWebResource",retired).get("value")).get("status"));
            AtomicReference<PlanetChildWebResources> handler=new AtomicReference<>();scenario.onActivity(value->{try{handler.set(value.childWebResources());}catch(Exception error){throw new AssertionError(error);}});assertEquals(403,handler.get().shouldInterceptRequest(handler.get().web(),new Request(uri,false)).getStatusCode());
            Field outputs=PlanetChildVault.LocalV2AppOwner.class.getDeclaredField("webOutputs");outputs.setAccessible(true);assertTrue("Actual native output/buffer retirement joined",((Map<?,?>)outputs.get(original.get())).isEmpty());
            invoke(original.get(),"releaseScene",map("version",2L,"requestId",UUID.randomUUID().toString().replace("-",""),"contextToken",context,"sceneToken",sceneToken));js(activity.get(),"delete window.__canonicalNativeFixture");
        }
    }
}