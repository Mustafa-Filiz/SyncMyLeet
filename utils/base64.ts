export function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function decodeBase64(content: string): string {
  // GitHub API may return Base64 content with line breaks.
  const normalized = content.replace(/\s/g, "");

  const binary = atob(normalized);

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder("utf-8").decode(bytes);
}
