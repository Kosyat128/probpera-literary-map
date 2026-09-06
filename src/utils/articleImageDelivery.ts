import imageDelivery from "../data/imageDelivery.articles.generated.json";
import { registerPublicImageDelivery } from "./imageDelivery";
import type { CompactImageDeliveryManifest } from "./imageDeliveryModel";

// This dependency belongs to the lazy article reader. Module initialization
// completes before its first render sanitizes HTML or creates an image element.
registerPublicImageDelivery(imageDelivery as unknown as CompactImageDeliveryManifest);
