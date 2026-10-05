package ru.probpera.literaryplanet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Map;

/** Genuine LOCAL2 App registration. No Web implementation, caller proof,
 * arbitrary vault path, debug key or JS cancellation acknowledgement exists. */
@CapacitorPlugin(name="PlanetChild")
public final class PlanetChildPlugin extends Plugin {
    private PlanetChildVault.LocalV2AppOwner owner;
    private static JSObject js(Map<String,Object> value) {
        org.json.JSONObject wrapped=new org.json.JSONObject(value);JSObject out=new JSObject();
        java.util.Iterator<String> names=wrapped.keys();
        while(names.hasNext()){String name=names.next();out.put(name,wrapped.opt(name));}
        return out;
    }
    @Override public void load() {
        try { owner=PlanetChildVault.nativeAppOwner(getActivity(),value->notifyListeners("invalidated",js(value))); }
        catch(Exception unavailable) { owner=null; }
    }
    private void dispatch(String method,PluginCall call) {
        final PlanetChildVault.LocalV2AppOwner original=owner;
        try {
            Map<String,Object> dto=PlanetChildDataTransport.ownV2DTO(call.getData());
            if(original==null) { call.reject("Native child bootstrap unavailable","CHILD_UNAVAILABLE");return; }
            original.execute(PlanetChildDataTransport.decodeV2(method,dto),reply->call.resolve(js(reply)));
        } catch(Exception invalid) {
            if(original!=null)original.invalidate("unsupported");
            call.reject("Native child request unavailable","CHILD_UNAVAILABLE");
        }
    }
    @PluginMethod public void bootstrap(PluginCall call){dispatch("bootstrap",call);}
    @PluginMethod public void readContext(PluginCall call){dispatch("readContext",call);}
    @PluginMethod public void perform(PluginCall call){dispatch("perform",call);}
    @PluginMethod public void retire(PluginCall call){dispatch("retire",call);}
    @PluginMethod public void readEntity(PluginCall call){dispatch("readEntity",call);}
    @PluginMethod public void search(PluginCall call){dispatch("search",call);}
    @PluginMethod public void readCollection(PluginCall call){dispatch("readCollection",call);}
    @com.getcapacitor.PluginMethod public void listMedia(com.getcapacitor.PluginCall call){dispatch("listMedia",call);}
    @com.getcapacitor.PluginMethod public void presentMedia(com.getcapacitor.PluginCall call){dispatch("presentMedia",call);}
    @com.getcapacitor.PluginMethod public void releaseMedia(com.getcapacitor.PluginCall call){dispatch("releaseMedia",call);}
    @PluginMethod public void writeCollection(PluginCall call){dispatch("writeCollection",call);}
    @PluginMethod public void readSceneSelection(PluginCall call){dispatch("readSceneSelection",call);}
    @PluginMethod public void rememberSceneSelection(PluginCall call){dispatch("rememberSceneSelection",call);}
    @PluginMethod public void restoreSceneSelection(PluginCall call){dispatch("restoreSceneSelection",call);}
    @PluginMethod public void listScenes(PluginCall call){dispatch("listScenes",call);}
    @PluginMethod public void openScene(PluginCall call){dispatch("openScene",call);}
    @PluginMethod public void releaseScene(PluginCall call){dispatch("releaseScene",call);}
    @PluginMethod public void acquireWebResource(PluginCall call){dispatch("acquireWebResource",call);}
    @PluginMethod public void releaseWebResource(PluginCall call){dispatch("releaseWebResource",call);}
    @PluginMethod public void listJourneys(PluginCall call){dispatch("listJourneys",call);}
    @PluginMethod public void readJourneyProgress(PluginCall call){dispatch("readJourneyProgress",call);}
    @PluginMethod public void openJourney(PluginCall call){dispatch("openJourney",call);}
    @PluginMethod public void advanceJourney(PluginCall call){dispatch("advanceJourney",call);}
    @PluginMethod public void closeJourney(PluginCall call){dispatch("closeJourney",call);}
    @Override protected void handleOnPause(){if(owner!=null)owner.hostPaused();}
    @Override protected void handleOnStop(){if(owner!=null)owner.hostStopped();}
    @Override protected void handleOnDestroy(){if(owner!=null)owner.destroy();}
    @Override protected void handleOnNewIntent(android.content.Intent intent){if(owner!=null)owner.nativeRouteInput();}
    @PluginMethod public void listDiscovery(PluginCall call){dispatch("listDiscovery",call);}
    @PluginMethod public void readPassport(PluginCall call){dispatch("readPassport",call);}
    @PluginMethod public void recordCountryOpen(PluginCall call){dispatch("recordCountryOpen",call);}
}
