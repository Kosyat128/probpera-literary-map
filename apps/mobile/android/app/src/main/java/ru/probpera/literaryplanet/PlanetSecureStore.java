package ru.probpera.literaryplanet;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** OS crypto only: nonexportable AndroidKeystore AES key and app-private,
 * no-backup ciphertext. No Preferences/plaintext fallback or key regeneration
 * over existing ciphertext. Hardware-backed protection is not assumed.
 * This ordinary session store is NOT child authority or anti-rollback CAS. */
final class PlanetSecureStore {
    static final int MAX_BYTES = 131072;
    private static final Object LOCK = new Object();
    private final Context context;
    private final boolean qa;
    PlanetSecureStore(Context context, boolean qa) {
        this.context = context.getApplicationContext();
        this.qa = qa && (this.context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }
    private void require(boolean condition) throws Exception { if (!condition) throw new Exception("secure-storage-unavailable"); }
    private void unlocked() throws Exception {
        KeyguardManager manager = (KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE);
        require(manager != null && !manager.isDeviceLocked());
    }
    private File directory() throws Exception {
        File parent = context.getNoBackupFilesDir().getCanonicalFile();
        File root = new File(parent, "literary-planet-secure-v1");
        require(root.getAbsoluteFile().equals(root.getCanonicalFile()));
        require(root.isDirectory() || root.mkdir());
        require(root.isDirectory() && root.getCanonicalFile().getParentFile().equals(parent));
        return root;
    }
    private AtomicFile record(String key) throws Exception {
        require(key != null && (key.matches("auth-(session|pkce|user)-v1:[a-z0-9]{20}")
            || qa && key.matches("secure-runtime-v1:[a-f0-9]{32}")));
        File root = directory(), file = new File(root, key.replace(':', '-'));
        require(file.getAbsoluteFile().equals(file.getCanonicalFile()) && file.getCanonicalFile().getParentFile().equals(root));
        for (String suffix : new String[] { "", ".bak", ".new" }) {
            File candidate = new File(file.getPath() + suffix);
            require(candidate.getAbsoluteFile().equals(candidate.getCanonicalFile()));
            if (candidate.exists()) require(candidate.isFile() && candidate.length() <= MAX_BYTES + 29);
        }
        return new AtomicFile(file);
    }
    private String alias() { return context.getPackageName() + ".literary-planet-session-aes-v1"; }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(alias())) {
            java.security.Key existing = store.getKey(alias(), null);
            require(existing instanceof SecretKey); return (SecretKey) existing;
        }
        require(create);
        // Missing keys with ANY preserved ciphertext are unavailable, not reset.
        File[] entries = directory().listFiles(); require(entries != null && entries.length == 0);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(alias(), KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true);
        if (Build.VERSION.SDK_INT >= 28) builder.setUnlockedDeviceRequired(true);
        generator.init(builder.build()); return generator.generateKey();
    }
    String get(String name) throws Exception {
        synchronized (LOCK) {
            unlocked(); AtomicFile file = record(name);
            if (!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists()) return null;
            byte[] encoded = file.readFully(), plaintext = null;
            try {
                require(encoded.length >= 1 + 12 + 16 + 1 && encoded.length <= MAX_BYTES + 29 && encoded[0] == 1);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Arrays.copyOfRange(encoded, 1, 13)));
                cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
                plaintext = cipher.doFinal(encoded, 13, encoded.length - 13);
                require(plaintext.length > 0 && plaintext.length <= MAX_BYTES);
                unlocked(); return new String(plaintext, StandardCharsets.UTF_8);
            } finally { Arrays.fill(encoded, (byte) 0); if (plaintext != null) Arrays.fill(plaintext, (byte) 0); }
        }
    }
    void set(String name, String value) throws Exception {
        synchronized (LOCK) {
            unlocked(); AtomicFile file = record(name); require(value != null && value.length() > 0 && value.length() <= MAX_BYTES);
            byte[] plaintext = value.getBytes(StandardCharsets.UTF_8), encoded = null;
            try {
                require(plaintext.length > 0 && plaintext.length <= MAX_BYTES);
                Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key(true));
                byte[] iv = cipher.getIV(); require(iv != null && iv.length == 12);
                cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8)); byte[] ciphertext = cipher.doFinal(plaintext);
                encoded = ByteBuffer.allocate(13 + ciphertext.length).put((byte) 1).put(iv).put(ciphertext).array();
                unlocked(); FileOutputStream stream = null;
                try { stream = file.startWrite(); stream.write(encoded); file.finishWrite(stream); stream = null; }
                finally { if (stream != null) file.failWrite(stream); }
                require(value.equals(get(name)));
            } finally { Arrays.fill(plaintext, (byte) 0); if (encoded != null) Arrays.fill(encoded, (byte) 0); }
        }
    }
    void remove(String name) throws Exception {
        synchronized (LOCK) {
            unlocked(); AtomicFile file = record(name); file.delete();
            require(!file.getBaseFile().exists() && !new File(file.getBaseFile().getPath() + ".bak").exists()
                && !new File(file.getBaseFile().getPath() + ".new").exists());
        }
    }
}
