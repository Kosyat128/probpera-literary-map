import imageDelivery from "../data/imageDelivery.generated.json";
import { createImageDeliveryResolver } from "./imageDeliveryModel";

export { createImageDeliveryResolver } from "./imageDeliveryModel";
const delivery = createImageDeliveryResolver(imageDelivery, import.meta.env.BASE_URL);
export const publicImageAttributes = delivery.attributes;
export const publicImageUrl = delivery.url;
export const originalImageUrl = delivery.original;
