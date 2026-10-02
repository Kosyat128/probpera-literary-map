package ru.probpera.literaryplanet;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlanetContentStorePlugin.class);
        registerPlugin(PlanetSecureStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
