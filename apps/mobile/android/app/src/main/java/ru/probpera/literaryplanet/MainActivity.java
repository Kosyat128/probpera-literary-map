package ru.probpera.literaryplanet;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    private PlanetChildWebResources childResources;
    final PlanetChildWebResources childWebResources() throws Exception {
        if(android.os.Looper.myLooper()!=android.os.Looper.getMainLooper()||getBridge()==null)throw new PlanetChildVault.Unavailable();
        if(childResources==null)childResources=PlanetChildWebResources.install(this);
        return childResources;
    }
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlanetContentStorePlugin.class);
        registerPlugin(PlanetSecureStorePlugin.class);
        registerPlugin(PlanetChildPlugin.class);
        super.onCreate(savedInstanceState);
        try{childWebResources();}catch(Exception unavailable){childResources=null;}
    }
}
