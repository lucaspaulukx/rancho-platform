/** Shared UTF-8 codec for terminal input and native base64 secret payloads. */
export function encodeUtf8Base64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192)
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}
