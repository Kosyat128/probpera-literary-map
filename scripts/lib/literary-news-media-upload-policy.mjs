/** Provider upload hosts are independent from editorial source/download hosts.
 * Unknown VK host profiles fail closed; redirects never inherit this permission.
 */
export function checkedVkNewsUploadUrl(input) {
  let url; try { url = new URL(input); } catch { throw new Error("vk_upload_host_unapproved"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")
    || !/^pu\d*\.(?:vk\.com|vkuserphoto\.ru|userapi\.com)$/.test(url.hostname)
    || !/^\/[a-zA-Z0-9_./-]+$/.test(url.pathname)) throw new Error("vk_upload_host_unapproved");
  return url;
}
