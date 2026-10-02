package ru.probpera.literaryplanet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "PlanetSecureStore")
public class PlanetSecureStorePlugin extends Plugin {
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private interface Work { JSObject run(PlanetSecureStore store) throws Exception; }
    private void queued(PluginCall call, Work work) {
        IO.execute(() -> {
            try { call.resolve(work.run(new PlanetSecureStore(getContext(), false))); }
            catch (Exception ignored) { call.reject("Secure storage is unavailable", "SECURE_STORAGE_UNAVAILABLE"); }
        });
    }
    @PluginMethod public void get(PluginCall call) {
        queued(call, store -> { String value = store.get(call.getString("key")); JSObject result = new JSObject(); result.put("value", value == null ? JSONObject.NULL : value); return result; });
    }
    @PluginMethod public void set(PluginCall call) {
        queued(call, store -> { store.set(call.getString("key"), call.getString("value")); JSObject result = new JSObject(); result.put("stored", true); return result; });
    }
    @PluginMethod public void remove(PluginCall call) {
        queued(call, store -> { store.remove(call.getString("key")); JSObject result = new JSObject(); result.put("removed", true); return result; });
    }
}
