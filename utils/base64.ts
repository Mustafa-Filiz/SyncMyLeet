export function encodeBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
