package ru.probpera.literaryplanet;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Own fresh dev-emulator predecessor fixture only. Resolve the OLD target's
 * existing Capacitor Preferences classes, without new JS/secure-store APIs.
 * Seed/remove only three UUID-prefixed nonsecret QA keys in its existing group.
 * The runner verifies durable preservation through force-stop, APK -r update,
 * exact installed-byte equality and the CURRENT installed JS preference guard.
 * This fixture proves neither secret migration nor protected child authority. */
@RunWith(AndroidJUnit4.class)
public class PlanetPreviousPreferencesRuntimeTest {
    @Test public void previousPreferencesPhase() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("ru.probpera.literaryplanet.dev", context.getPackageName());
        assertTrue((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        String runId = InstrumentationRegistry.getArguments().getString("literaryRunId");
        String phase = InstrumentationRegistry.getArguments().getString("literaryPhase");
        assertTrue(runId != null && runId.matches("[a-f0-9]{32}"));
        assertTrue("write".equals(phase) || "read".equals(phase) || "remove".equals(phase));
        ClassLoader targetLoader = context.getClassLoader();
        Class<?> configuration = Class.forName("com.capacitorjs.plugins.preferences.PreferencesConfiguration", true, targetLoader);
        Class<?> preferences = Class.forName("com.capacitorjs.plugins.preferences.Preferences", true, targetLoader);
        Field defaults = configuration.getDeclaredField("DEFAULTS"); defaults.setAccessible(true);
        Object config = defaults.get(null);
        Field group = configuration.getDeclaredField("group"); group.setAccessible(true);
        assertEquals("CapacitorStorage", group.get(config)); // Never configure or change the default group.
        Constructor<?> constructor = preferences.getDeclaredConstructor(Context.class, configuration); constructor.setAccessible(true);
        Object store = constructor.newInstance(context, config);
        Method get = preferences.getMethod("get", String.class), set = preferences.getMethod("set", String.class, String.class);
        Method remove = preferences.getMethod("remove", String.class);
        String prefix = "literary-native-runtime-" + runId + ":";
        String[] keys = {"probpera-interface-language", "probpera-display-mode", "probpera-booky-size-v1"};
        String[] values = {"en", "book", "large"};
        if ("write".equals(phase)) {
            for (int index = 0; index < keys.length; index++) set.invoke(store, prefix + keys[index], values[index]);
        } else if ("remove".equals(phase)) {
            Exception failure = null;
            for (String key : keys) { try { remove.invoke(store, prefix + key); } catch (Exception error) { if (failure == null) failure = error; } }
            if (failure != null) throw failure;
        }
        for (int index = 0; index < keys.length; index++) {
            Object value = get.invoke(store, prefix + keys[index]);
            if ("remove".equals(phase)) assertNull(value); else assertEquals(values[index], value);
        }
    }
}
