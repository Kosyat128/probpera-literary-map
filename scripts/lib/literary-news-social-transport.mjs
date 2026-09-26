import { checkedDestination, canonicalNewsSocialValue, newsSocialPayloadDigest } from "./literary-news-social.mjs";
import { newsDigest } from "./literary-news-publication.mjs";
import { mediaByteHash, validatePreparedNewsMedia } from "./literary-news-media.mjs";
import { checkedVkNewsUploadUrl, uploadPinnedVkNewsPhoto } from "./literary-news-media-upload.mjs";

async function boundedJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > 262144) throw new Error("provider_reply_too_large");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
const validId = (id) => Number.isSafeInteger(id) && id > 0;
const retrySeconds = (value, fallback = 60) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Math.min(Number(value), 86400) : fallback;
function vkUploadFailure(response) {
  const {status,data}=response;
  if(status===429 || [6,9].includes(data?.error?.error_code)) return {kind:"retry",scope:"retry",code:"provider_rate_limited",retryAfterSeconds:retrySeconds(response.retryAfter)};
  if([401,403].includes(status) || [5,7,15,27,28].includes(data?.error?.error_code)) return {kind:"blocked",scope:"auth",code:"vk_permission_denied"};
  if(status>=500) return {kind:"retry",scope:"retry",code:"media_upload_not_published",retryAfterSeconds:60};
  if(data?.error || status<200 || status>=300) return {kind:"blocked",code:"vk_photo_request_rejected"};
  return null;
}
const validAccount = (id) => typeof id === "string" && /^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id));
function mediaCacheMatches(cache, destination, prepared, providerAccountId) {
  return cache?.platform === destination.platform && cache.destinationId === destination.id
    && validAccount(providerAccountId) && cache.providerAccountId === providerAccountId
    && cache.sha256 === prepared.media?.sha256 && (destination.platform === "telegram"
      ? typeof cache.fileId === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(cache.fileId)
      : new RegExp(`^photo${destination.id}_[1-9]\\d*$`).test(cache.attachment || ""));
}

/** Shadow has no platform write capability, including uploads. Credentials never enter diagnostics. */
export function createNewsSocialTransport({ mode = "shadow", telegramToken, vkToken, fetchImpl = fetch,
  uploadImpl = uploadPinnedVkNewsPhoto, mediaOptions } = {}) {
  const call = async (platform, method, data, photo = null) => {
    const token = platform === "telegram" ? telegramToken : vkToken;
    if (!token) return { status: 401, data: null };
    const target = platform === "telegram" ? `https://api.telegram.org/bot${token}/${method}` : `https://api.vk.com/method/${method}`;
    let body = platform === "telegram" ? JSON.stringify(data) : new URLSearchParams({ ...data, access_token: token, v: "5.199" }).toString();
    if (photo) {
      body = new FormData();
      for (const [key,value] of Object.entries(data)) body.append(key,typeof value === "object" ? JSON.stringify(value) : String(value));
      body.append("news_photo",new Blob([photo],{type:"image/jpeg"}),"news.jpg");
    }
    const response = await fetchImpl(target, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: photo ? {} : { "Content-Type": platform === "telegram" ? "application/json" : "application/x-www-form-urlencoded" }, body });
    return { status: response.status, retryAfter: response.headers.get("retry-after"), data: await boundedJson(response) };
  };
  return {
    async preflight(destination, {control = null,requiresMedia = false} = {}) {
      checkedDestination({ ...destination, mode: "off" });
      try {
        if (destination.platform === "telegram") {
          const me = await call("telegram", "getMe", {});
          if (me.data?.ok !== true || !validId(me.data.result?.id)) return { ok: false, reason: "bot_identity_unverified" };
          const chat = await call("telegram", "getChat", { chat_id: destination.id });
          const rights = await call("telegram", "getChatMember", { chat_id: destination.id, user_id: me.data.result.id });
          const member = rights.data?.result;
          return { ok: chat.data?.ok === true && String(chat.data.result?.id) === destination.id
            && chat.data.result?.type === "channel" && rights.data?.ok === true
            && (member?.status === "creator" || member?.status === "administrator" && member.can_post_messages === true && member.can_edit_messages === true),
          destinationId: String(chat.data?.result?.id || ""), providerAccountId: String(me.data.result.id) };
        }
        const result = await call("vk", "groups.getById", { group_id: destination.id.slice(1), fields: "can_post" });
        const group = result.data?.response?.groups?.[0] || result.data?.response?.[0];
        const user = await call("vk", "users.get", {});
        const permissions = await call("vk", "account.getAppPermissions", {});
        const account = user.data?.response?.[0];
        const identityVerified = `-${group?.id}` === destination.id && group.can_post === 1;
        const rightsVerified = identityVerified && validId(account?.id) && group.is_admin === 1
          && [2,3].includes(group.admin_level) && Number.isSafeInteger(permissions.data?.response)
          && (permissions.data.response & 8192) !== 0 && (!requiresMedia || (permissions.data.response & 4) !== 0);
        const profileApproved = control?.vkProfile?.apiVersion === "5.199"
          && control.vkProfile.providerAccountId === String(account?.id)
          && control.vkProfile.postAndEditConfirmed === true && control.vkProfile.linkPreviewVerified === true;
        const authorizedCanary = control?.mode === "canary" && control.canaryNewsId
          && control.vkProfile?.canaryAuthorized === true;
        return { ok: Boolean(rightsVerified && (profileApproved || authorizedCanary)),
          destinationId: group?.id ? `-${group.id}` : null, providerAccountId: account?.id ? String(account.id) : null,
          identityVerified, rightsVerified, profileApproved,
          reason: !rightsVerified ? "vk_user_token_or_permissions_unverified" : profileApproved || authorizedCanary ? null : "vk_profile_canary_required" };
      } catch { return { ok: false, reason: "preflight_unavailable" }; }
    },
    async prepareDelivery({destination,prepared,providerAccountId,cachedMedia}) {
      if(mode!=="live") return {kind:"blocked",code:"shadow_external_write_disabled"};
      if(prepared.sendable===false) return {kind:"blocked",code:"preview_not_sendable"};
      if(!prepared.media) return {kind:"ready",delivery:null};
      if(!validAccount(providerAccountId)) return {kind:"blocked",code:"media_provider_identity_unverified"};
      let bytes;
      try { bytes=await validatePreparedNewsMedia(prepared,destination,mediaOptions); }
      catch { return {kind:"blocked",code:"media_rights_or_bytes_invalid"}; }
      const scope={platform:destination.platform,destinationId:destination.id,providerAccountId,sha256:prepared.media.sha256};
      if(mediaCacheMatches(cachedMedia,destination,prepared,providerAccountId)) return {kind:"ready",delivery:{
        ...scope,...(destination.platform==="telegram"?{fileId:cachedMedia.fileId}:{attachment:cachedMedia.attachment}),cache:cachedMedia,reused:true}};
      if(destination.platform==="telegram") return {kind:"ready",delivery:{bytes,...scope}};
      try {
        const server=await call("vk","photos.getWallUploadServer",{group_id:destination.id.slice(1)});
        const serverFailure=vkUploadFailure(server);if(serverFailure)return serverFailure;
        const uploadUrl=checkedVkNewsUploadUrl(server.data?.response?.upload_url);
        const form=new FormData();form.append("photo",new Blob([bytes],{type:"image/jpeg"}),"news.jpg");
        const uploadedResponse=await uploadImpl(uploadUrl.href,form);
        const uploadFailure=vkUploadFailure({status:uploadedResponse.status,data:null,retryAfter:uploadedResponse.headers.get("retry-after")});if(uploadFailure)return uploadFailure;
        const uploaded=await boundedJson(uploadedResponse);
        if(!Number.isSafeInteger(uploaded?.server) || uploaded.server<=0 || typeof uploaded.photo!=="string"
          || uploaded.photo.length>65536 || !uploaded.photo || typeof uploaded.hash!=="string" || !/^[a-zA-Z0-9_-]{1,256}$/.test(uploaded.hash))
          return {kind:"blocked",code:"vk_photo_upload_receipt_invalid"};
        const saved=await call("vk","photos.saveWallPhoto",{group_id:destination.id.slice(1),server:uploaded.server,photo:uploaded.photo,hash:uploaded.hash});
        const savedFailure=vkUploadFailure(saved);if(savedFailure)return savedFailure;
        const photo=saved.data?.response?.[0];
        if(!validId(photo?.id) || String(photo?.owner_id)!==destination.id || saved.data.response.length!==1)
          return {kind:"blocked",code:"vk_saved_photo_receipt_invalid"};
        const cache={...scope,attachment:`photo${photo.owner_id}_${photo.id}`};
        return {kind:"ready",delivery:{...scope,attachment:cache.attachment,cache,reused:false}};
      } catch(error) {
        return {kind:/^vk_upload_(host_unapproved|address_rejected)$/.test(error.message)?"blocked":"retry",
          code:/^vk_upload_(host_unapproved|address_rejected)$/.test(error.message)?error.message:"media_upload_not_published",retryAfterSeconds:60};
      }
    },
    async send({ destination, prepared, remoteId, remoteMediaKind = "text", delivery = null }) {
      if (mode !== "live") return { kind: "blocked", code: "shadow_external_write_disabled" };
      if(prepared.sendable===false) return {kind:"blocked",code:"preview_not_sendable"};
      checkedDestination({ ...destination, mode: "on" });
      if (prepared.platform !== destination.platform) return { kind: "blocked", code: "payload_platform_mismatch" };
      if (await newsSocialPayloadDigest(prepared.payload) !== prepared.payloadSha256)
        return { kind: "blocked", code: "prepared_bytes_changed" };
      const payload = canonicalNewsSocialValue(prepared.payload);
      if (destination.platform === "telegram" && !telegramToken || destination.platform === "vk" && !vkToken)
        return { kind: "blocked", scope: "auth", code: "provider_token_missing" };
      if (remoteId !== null && !validId(Number(remoteId))) return { kind: "blocked", code: "remote_id_invalid" };
      if (destination.platform === "telegram" && remoteId && remoteMediaKind === "photo" && !prepared.media)
        return {kind:"blocked",code:"telegram_photo_removal_requires_operator"};
      if(prepared.media) {
        try { await validatePreparedNewsMedia(prepared,destination,mediaOptions); }
        catch { return {kind:"blocked",code:"media_rights_or_bytes_invalid"}; }
        if(delivery?.sha256!==prepared.media.sha256 || !validAccount(delivery?.providerAccountId) || destination.platform==="telegram"
          && !(mediaCacheMatches(delivery.cache,destination,prepared,delivery.providerAccountId) && delivery.fileId === delivery.cache.fileId)
          && (!Buffer.isBuffer(delivery?.bytes) || mediaByteHash(delivery.bytes)!==prepared.media.sha256)
          || destination.platform==="vk" && !new RegExp(`^photo${destination.id}_[1-9]\\d*$`).test(delivery?.attachment || ""))
          return {kind:"blocked",code:"media_delivery_not_prepared"};
      }
      let response;
      try {
        response = destination.platform === "telegram"
          ? await call("telegram", prepared.media ? remoteId ? "editMessageMedia" : "sendPhoto" : remoteId ? "editMessageText" : "sendMessage", {
            ...(prepared.media && remoteId ? {media:{type:"photo",media:delivery.fileId || payload.photo,caption:payload.caption,caption_entities:payload.caption_entities}}
              : {...payload,...(prepared.media && delivery.fileId?{photo:delivery.fileId}:{})}),
            chat_id: destination.id, ...(remoteId ? { message_id: Number(remoteId) } : {}),
          },prepared.media && !delivery.fileId?delivery.bytes:null)
          : await call("vk", remoteId ? "wall.edit" : "wall.post", {
            ...payload, ...(prepared.media?{attachments:delivery.attachment}:{}), owner_id: destination.id, ...(remoteId ? { post_id: Number(remoteId) } : {}),
            ...(remoteId ? {} : { guid: (await newsDigest(["news", prepared.newsId, destination.platform, destination.id])).slice(0, 32) }),
          });
      } catch { return { kind: "ambiguous", code: "provider_outcome_unknown" }; }
      const { status, data } = response;
      if (status === 429 || data?.error_code === 429 || [6, 9].includes(data?.error?.error_code))
        return { kind: "retry", scope: "retry", code: "provider_rate_limited",
          retryAfterSeconds: retrySeconds(data?.parameters?.retry_after || response.retryAfter) };
      if (status >= 500) return { kind: "ambiguous", code: "provider_server_error" };
      if (destination.platform === "telegram") {
        if (data?.ok === true && validId(data.result?.message_id) && String(data.result?.chat?.id) === destination.id
          && (!prepared.media || Array.isArray(data.result?.photo) && data.result.photo.some((photo)=>typeof photo.file_id === "string" && photo.file_id))
          && (!remoteId || data.result.message_id === Number(remoteId))) return {
          kind: "accepted", remoteId: String(data.result.message_id),remoteMediaKind:prepared.media?"photo":"text",
          ...(prepared.media ? {mediaCache:{platform:destination.platform,destinationId:destination.id,providerAccountId:delivery.providerAccountId,
            sha256:prepared.media.sha256,fileId:data.result.photo.filter(photo=>typeof photo.file_id === "string" && /^[A-Za-z0-9_-]{1,1024}$/.test(photo.file_id)).at(-1)?.file_id}} : {}),
          remoteUrl: /^-100\d+$/.test(destination.id) ? `https://t.me/c/${destination.id.slice(4)}/${data.result.message_id}` : null,
        };
        if (data?.ok === false && [401, 403].includes(data.error_code)) return { kind: "blocked", scope: "auth", code: "telegram_permission_denied" };
        if (data?.ok === false && data.error_code === 400) return { kind: "blocked", code: "telegram_request_rejected" };
      } else {
        if (!data?.error && validId(data?.response?.post_id)
          && (!remoteId || data.response.post_id === Number(remoteId))) {
          const id = remoteId || String(data.response.post_id);
          return { kind: "accepted", remoteId: String(id), remoteMediaKind:prepared.media?"photo":"text",
            ...(prepared.media?{mediaCache:delivery.cache}:{}),remoteUrl: `https://vk.com/wall${destination.id}_${id}` };
        }
        if ([5, 7, 15, 27, 28].includes(data?.error?.error_code)) return { kind: "blocked", scope: "auth", code: "vk_permission_denied" };
        if ([100, 214].includes(data?.error?.error_code)) return { kind: "blocked", code: "vk_request_rejected" };
      }
      return { kind: "ambiguous", code: "provider_receipt_invalid" };
    },
  };
}
