package ru.probpera.literaryplanet;

import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Executes the installed dev JS guard against real OS Preferences under exact
 * isolated per-run keys. Fault/timeout phases explicitly report synthetic
 * boundaries. No arbitrary script input, production group or broad clear. */
@RunWith(AndroidJUnit4.class)
public class PlanetPreferencesRuntimeTest {
    private String evaluate(Instrumentation instrumentation, MainActivity activity, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        instrumentation.runOnMainSync(() -> activity.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue(done.await(2, TimeUnit.SECONDS)); return result.get();
    }
    @Test public void preferencesPhase() throws Exception {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation(); Context context = instrumentation.getTargetContext();
        assertEquals("ru.probpera.literaryplanet.dev", context.getPackageName());
        assertTrue((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        String runId = InstrumentationRegistry.getArguments().getString("literaryRunId"), phase = InstrumentationRegistry.getArguments().getString("literaryPhase");
        assertTrue(runId != null && runId.matches("[a-f0-9]{32}"));
        assertTrue(Arrays.asList("write", "read", "remove", "corrupt", "unsupported-language", "unsupported-theme", "parallel", "plugin-failure", "timeout", "absent", "clear").contains(phase));
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(intent);
        long deadline = SystemClock.elapsedRealtime() + 15000;
        while (!"true".equals(evaluate(instrumentation, activity, "typeof window.__LITERARY_PLANET_NATIVE_PREFERENCES_QA__?.run === 'function'"))) {
            assertTrue(SystemClock.elapsedRealtime() < deadline); Thread.sleep(50);
        }
        evaluate(instrumentation, activity, "window.__LP_PREFERENCE_QA_RESULT__=null;window.__LITERARY_PLANET_NATIVE_PREFERENCES_QA__.run('" + runId + "','" + phase
            + "').then(r=>window.__LP_PREFERENCE_QA_RESULT__=r).catch(()=>window.__LP_PREFERENCE_QA_RESULT__={status:'FAIL'});'scheduled'");
        JSONObject result = null; deadline = SystemClock.elapsedRealtime() + 15000;
        while (result == null) {
            String raw = evaluate(instrumentation, activity, "JSON.stringify(window.__LP_PREFERENCE_QA_RESULT__)");
            Object value = new JSONTokener(raw).nextValue();
            if (value instanceof String && !"null".equals(value)) result = new JSONObject((String) value);
            else { assertTrue(SystemClock.elapsedRealtime() < deadline); Thread.sleep(50); }
        }
        assertEquals(1, result.getInt("schemaVersion")); assertEquals(runId, result.getString("runId")); assertEquals(phase, result.getString("case"));
        assertEquals("PASS", result.getString("status"));
        assertEquals(phase.equals("plugin-failure") || phase.equals("timeout") ? "synthetic-boundary" : "native-os", result.getString("backend"));
        instrumentation.runOnMainSync(activity::finish);
    }
}
