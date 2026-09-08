import imageDelivery from "../data/imageDelivery.initial.generated.json";
import { isControlledWebEdition } from "../platform/distribution";
import { createControlledImageDeliveryResolver } from "./imageDeliveryControlled";
import { createImageDeliveryResolver, expandImageDeliveryManifest, type CompactImageDeliveryManifest } from "./imageDeliveryModel";

export { createImageDeliveryResolver } from "./imageDeliveryModel";
const delivery = (isControlledWebEdition ? createControlledImageDeliveryResolver : createImageDeliveryResolver)(
  expandImageDeliveryManifest(imageDelivery as unknown as CompactImageDeliveryManifest), import.meta.env.BASE_URL,
);
export const publicImageAttributes = delivery.attributes;
export const publicImageUrl = delivery.url;
export const originalImageUrl = delivery.original;
export const registerPublicImageDelivery = (manifest: CompactImageDeliveryManifest) => delivery.register(expandImageDeliveryManifest(manifest));
