package ru.probpera.literaryplanet;

import androidx.core.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** App-private QA bytes. No external storage, catalog, network or entitlement API.
 * AndroidX AtomicFile also protects an interrupted first write on Android API 24.
 * Every operation, including
 * selection CAS and protected pruning, runs in one queue across plugin instances. */
@CapacitorPlugin(name = "PlanetContentStore")
public class PlanetContentStorePlugin extends Plugin {
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final String PREFIX = "literary-planet-content-qa-v1-";
    private static final String SHA = "[a-f0-9]{64}";
    private static final int MAX_FILE = 16 * 1024 * 1024;
    private static final int MAX_PACKAGE = 64 * 1024 * 1024 + 256 * 1024;
    private static final String URL = "https://localhost/__literary_content_qa__/";

    private interface Operation { JSObject run() throws Exception; }
    private void queued(PluginCall call, Operation operation) {
        IO.execute(() -> {
            try { call.resolve(operation.run()); }
            catch (Exception error) { call.reject("Native content storage operation failed", "CONTENT_STORAGE_UNAVAILABLE"); }
        });
    }
    private static void require(boolean condition) throws IOException {
        if (!condition) throw new IOException("Invalid content storage input");
    }
    private static boolean scope(String name) { return name != null && name.matches(PREFIX + SHA); }
    private static boolean generation(String name) { return name != null && name.matches(PREFIX + SHA + "-" + SHA); }
    private static String hash(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder result = new StringBuilder(64);
        for (byte value : digest) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }
    private static String key(String suffix) throws Exception { return hash((URL + suffix).getBytes(StandardCharsets.UTF_8)); }
    private File root() throws Exception {
        File parent = getContext().getNoBackupFilesDir().getCanonicalFile();
        File target = new File(parent, "literary-planet-content-qa-v1");
        require(target.getCanonicalFile().equals(target));
        require(target.isDirectory() || target.mkdir());
        return target;
    }
    private File directory(String name, boolean create) throws Exception {
        require(scope(name) || generation(name));
        File target = new File(root(), name);
        require(target.getCanonicalFile().equals(target));
        if (create) require(target.isDirectory() || target.mkdir());
        return target;
    }
    private AtomicFile entry(String name, String entryKey, boolean create) throws Exception {
        require(entryKey != null && entryKey.matches(SHA));
        File file = new File(directory(name, create), entryKey);
        // AtomicFile may restore .bak; do not follow any symlink in its file family.
        for (String suffix : new String[] { "", ".bak", ".new" }) {
            File member = new File(file.getPath() + suffix);
            require(member.getCanonicalFile().equals(member));
        }
        return new AtomicFile(file);
    }
    private byte[] readBytes(String name, String entryKey, int maximum) throws Exception {
        AtomicFile file = entry(name, entryKey, false);
        if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists()) return null;
        try (FileInputStream stream = file.openRead(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = stream.read(buffer)) != -1) { require(bytes.size() + count <= maximum); bytes.write(buffer, 0, count); }
            return bytes.toByteArray();
        }
    }
    private void writeBytes(String name, String entryKey, byte[] bytes) throws Exception {
        require(bytes.length > 0 && bytes.length <= MAX_FILE);
        AtomicFile file = entry(name, entryKey, true);
        FileOutputStream stream = null;
        try { stream = file.startWrite(); stream.write(bytes); file.finishWrite(stream); }
        catch (Exception error) { if (stream != null) file.failWrite(stream); throw error; }
    }
    private static JSONObject selection(byte[] bytes) throws Exception {
        require(bytes != null && bytes.length > 0 && bytes.length <= 1024);
        JSONObject value = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        require(value.length() == 3 && value.getInt("schemaVersion") == 1 && value.has("previous"));
        JSONObject current = value.getJSONObject("current");
        validateGeneration(current);
        if (!value.isNull("previous")) {
            JSONObject prior = value.getJSONObject("previous"); validateGeneration(prior);
            require(prior.getLong("version") < current.getLong("version") && !prior.getString("sha256").equals(current.getString("sha256")));
        }
        return value;
    }
    private static void validateGeneration(JSONObject value) throws Exception {
        require(value.length() == 2 && value.getString("sha256").matches(SHA));
        double version = value.getDouble("version");
        require(version >= 1 && version <= 9007199254740991d && version == Math.floor(version));
    }
    @PluginMethod public void read(PluginCall call) {
        queued(call, () -> {
            byte[] bytes = readBytes(call.getString("name"), call.getString("key"), MAX_FILE);
            return new JSObject().put("base64", bytes == null ? JSONObject.NULL : Base64.encodeToString(bytes, Base64.NO_WRAP));
        });
    }
    @PluginMethod public void write(PluginCall call) {
        queued(call, () -> {
            String name = call.getString("name"), encoded = call.getString("base64");
            require(generation(name) && encoded != null && encoded.length() <= ((MAX_FILE + 2) / 3) * 4);
            writeBytes(name, call.getString("key"), Base64.decode(encoded, Base64.NO_WRAP));
            return new JSObject();
        });
    }
    @PluginMethod public void list(PluginCall call) {
        queued(call, () -> {
            JSArray names = new JSArray(); File[] entries = root().listFiles(); require(entries != null);
            for (File file : entries) if ((scope(file.getName()) || generation(file.getName())) && file.isDirectory()) {
                require(file.getCanonicalFile().equals(file)); names.put(file.getName());
            }
            return new JSObject().put("names", names);
        });
    }
    @PluginMethod public void remove(PluginCall call) {
        queued(call, () -> {
            String name = call.getString("name"); require(generation(name));
            String scopeName = name.substring(0, PREFIX.length() + 64), digest = name.substring(name.length() - 64);
            byte[] pointer = readBytes(scopeName, key("selection.json"), 1024);
            if (pointer != null) {
                JSONObject selected = selection(pointer);
                if (selected.getJSONObject("current").getString("sha256").equals(digest)
                    || (!selected.isNull("previous") && selected.getJSONObject("previous").getString("sha256").equals(digest))) {
                    return new JSObject().put("removed", false);
                }
            }
            File target = directory(name, false);
            if (!target.exists()) return new JSObject().put("removed", false);
            File[] files = target.listFiles(); require(files != null);
            // Flat, owned hashed files only; never recurse into an unexpected folder.
            for (File file : files) require(file.getName().matches(SHA + "(?:\\.bak|\\.new)?") && file.isFile() && file.getCanonicalFile().equals(file));
            for (File file : files) require(file.delete());
            require(target.delete());
            return new JSObject().put("removed", true);
        });
    }
    @PluginMethod public void commit(PluginCall call) {
        queued(call, () -> {
            String name = call.getString("name"), pointerKey = call.getString("key"), json = call.getString("json"), expected = call.getString("expectedSha256");
            require(scope(name) && key("selection.json").equals(pointerKey) && json != null);
            require(call.getData().has("expectedSha256") && (expected == null || expected.matches(SHA)));
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8); JSONObject next = selection(bytes);
            byte[] old = readBytes(name, pointerKey, 1024);
            if (old == null ? expected != null : !hash(old).equals(expected)) return new JSObject().put("committed", false);
            if (old != null) {
                JSONObject prior = selection(old);
                JSONObject nextCurrent = next.getJSONObject("current"), priorCurrent = prior.getJSONObject("current");
                if (nextCurrent.getString("sha256").equals(priorCurrent.getString("sha256"))) {
                    require(nextCurrent.getLong("version") == priorCurrent.getLong("version") && next.get("previous").toString().equals(prior.get("previous").toString()));
                } else {
                    require(nextCurrent.getLong("version") > priorCurrent.getLong("version") && next.get("previous").toString().equals(priorCurrent.toString()));
                }
            } else require(next.isNull("previous"));
            JSONObject candidate = call.getObject("candidate"); require(candidate != null);
            String candidateName = candidate.getString("name");
            require(candidateName.equals(name + "-" + next.getJSONObject("current").getString("sha256")));
            JSONArray entries = candidate.getJSONArray("entries"); require(entries.length() >= 4 && entries.length() <= 130);
            Set<String> seen = new HashSet<>(); long total = 0;
            // Receipts are produced by the shared signature verifier. Recheck ALL
            // bytes here, in the same serial operation as the atomic pointer write.
            for (int i = 0; i < entries.length(); i++) {
                JSONObject receipt = entries.getJSONObject(i); String entryKey = receipt.getString("key"), sha = receipt.getString("sha256");
                int size = receipt.getInt("bytes"); total += size;
                require(seen.add(entryKey) && sha.matches(SHA) && size > 0 && size <= MAX_FILE && total <= MAX_PACKAGE);
                byte[] stored = readBytes(candidateName, entryKey, size);
                require(stored != null && stored.length == size && hash(stored).equals(sha));
            }
            require(seen.contains(key("signature.json")) && seen.contains(key("complete.json")));
            writeBytes(name, pointerKey, bytes);
            require(java.util.Arrays.equals(readBytes(name, pointerKey, 1024), bytes));
            return new JSObject().put("committed", true);
        });
    }
}
