import { createIosPlatformAdapter } from "./IosPlatformAdapter";
import { mountHostApp, showHostInitializationFailure } from "../../../host/mountHostApp";
import { installNativePreferenceDiagnostics } from "../../../host/nativePreferenceDiagnostics";

if (__LITERARY_PLANET_IOS_CHANNEL__ === "dev") installNativePreferenceDiagnostics("ios");

void createIosPlatformAdapter({ channel: __LITERARY_PLANET_IOS_CHANNEL__ })
  .then(mountHostApp, showHostInitializationFailure)
  .catch(showHostInitializationFailure);
