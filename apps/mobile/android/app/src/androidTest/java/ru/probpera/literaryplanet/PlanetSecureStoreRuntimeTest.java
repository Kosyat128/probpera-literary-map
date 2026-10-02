package ru.probpera.literaryplanet;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Explicit own dev-emulator fixtures only. Never real credentials, production
 * records or proof of secure hardware. The runner retains this run's exact QA
 * key across process/reboot and removes only that key during cleanup. */
@RunWith(AndroidJUnit4.class)
public class PlanetSecureStoreRuntimeTest {
    private static final String SECRET = "synthetic-literary-planet-secret-v1";
    @Test public void secureStorageLifecycle() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertTrue(context.getPackageName().equals("ru.probpera.literaryplanet.dev"));
        assertTrue((context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        String runId = InstrumentationRegistry.getArguments().getString("literaryRunId");
        assertTrue(runId != null && runId.matches("[a-f0-9]{32}"));
        String key = "secure-runtime-v1:" + runId;
        String phase = InstrumentationRegistry.getArguments().getString("literaryPhase");
        PlanetSecureStore store = new PlanetSecureStore(context, true);
        if ("write".equals(phase)) {
            store.remove(key); assertNull(store.get(key)); store.set(key, SECRET);
            assertTrue(SECRET.equals(store.get(key)));
            File file = new File(new File(context.getNoBackupFilesDir(), "literary-planet-secure-v1"), key.replace(':', '-'));
            byte[] bytes = Files.readAllBytes(file.toPath());
            assertTrue(bytes.length > 29 && bytes[0] == 1);
            assertFalse(new String(bytes, StandardCharsets.UTF_8).contains(SECRET));
        } else if ("read".equals(phase)) {
            assertTrue(SECRET.equals(store.get(key)));
        } else if ("parallel".equals(phase)) {
            assertTrue(SECRET.equals(store.get(key)));
            CountDownLatch done = new CountDownLatch(4); AtomicReference<Throwable> failure = new AtomicReference<>();
            for (int index = 0; index < 4; index++) {
                final int value = index;
                new Thread(() -> {
                    try { store.set(key, SECRET + value); assertNotNull(store.get(key)); }
                    catch (Throwable error) { failure.compareAndSet(null, error); }
                    finally { done.countDown(); }
                }).start();
            }
            assertTrue(done.await(30, java.util.concurrent.TimeUnit.SECONDS)); assertNull(failure.get());
        } else if ("corrupt".equals(phase)) {
            assertNotNull(store.get(key));
            File file = new File(new File(context.getNoBackupFilesDir(), "literary-planet-secure-v1"), key.replace(':', '-'));
            byte[] bytes = Files.readAllBytes(file.toPath()); bytes[bytes.length - 1] ^= 1;
            try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); output.getFD().sync(); }
            boolean rejected = false; try { store.get(key); } catch (Exception expected) { rejected = true; }
            assertTrue(rejected);
        } else if ("remove".equals(phase)) {
            store.remove(key); assertNull(store.get(key));
        } else if ("clear".equals(phase)) {
            store.remove(key); assertNull(store.get(key));
        } else if ("absent".equals(phase)) {
            assertNull(store.get(key));
        } else fail("Unknown synthetic runtime phase");
    }
}
