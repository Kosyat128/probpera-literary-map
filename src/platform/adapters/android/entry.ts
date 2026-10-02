import { createAndroidPlatformAdapter } from "./AndroidPlatformAdapter";
import { mountHostApp, showHostInitializationFailure } from "../../../host/mountHostApp";
import { installNativePreferenceDiagnostics } from "../../../host/nativePreferenceDiagnostics";

if (__LITERARY_PLANET_ANDROID_CHANNEL__ === "dev") installNativePreferenceDiagnostics("android");

void createAndroidPlatformAdapter({ channel: __LITERARY_PLANET_ANDROID_CHANNEL__ })
  .then(mountHostApp, showHostInitializationFailure)
  .catch(showHostInitializationFailure);
