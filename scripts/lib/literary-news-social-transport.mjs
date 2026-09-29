import { createNewsSocialTransport as createCoreTransport } from "./literary-news-social-transport-core.mjs";
import { readNewsMediaBytes } from "./literary-news-media.mjs";
import { uploadPinnedVkNewsPhoto } from "./literary-news-media-upload.mjs";

/** Node adapters supply verified local JPEG bytes and the pinned VK upload client. */
export function createNewsSocialTransport(options = {}) {
  return createCoreTransport({ uploadImpl: uploadPinnedVkNewsPhoto, ...options,
    mediaOptions: { readBytes: readNewsMediaBytes, ...options.mediaOptions } });
}
