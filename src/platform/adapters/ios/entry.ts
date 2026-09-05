import { createIosPlatformAdapter } from "./IosPlatformAdapter";
import { mountHostApp, showHostInitializationFailure } from "../../../host/mountHostApp";

void createIosPlatformAdapter({ channel: __LITERARY_PLANET_IOS_CHANNEL__ })
  .then(mountHostApp, showHostInitializationFailure)
  .catch(showHostInitializationFailure);
