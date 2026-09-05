import { createAndroidPlatformAdapter } from "./AndroidPlatformAdapter";
import { mountHostApp, showHostInitializationFailure } from "../../../host/mountHostApp";

void createAndroidPlatformAdapter({ channel: __LITERARY_PLANET_ANDROID_CHANNEL__ })
  .then(mountHostApp, showHostInitializationFailure)
  .catch(showHostInitializationFailure);
