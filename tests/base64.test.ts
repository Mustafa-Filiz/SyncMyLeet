import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "@/utils/base64";

describe("encodeBase64", () => {
  it("should encode regular text", () => {
    expect(encodeBase64("Hello World")).toBe("SGVsbG8gV29ybGQ=");
  });

  it("should support UTF-8 characters", () => {
    const encoded = encodeBase64("Merhaba Dünya");

    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)),
    );

    expect(decoded).toBe("Merhaba Dünya");
  });
});

describe("Base64 utilities", () => {
  it("should encode and decode plain text", () => {
    const content = "Hello, GitHub!";

    expect(decodeBase64(encodeBase64(content))).toBe(content);
  });

  it("should support Unicode characters", () => {
    const content = "Çözüm: İyi çalışmalar! 🚀";

    expect(decodeBase64(encodeBase64(content))).toBe(content);
  });

  it("should decode Base64 content with line breaks", () => {
    const content = "LeetCode Solutions";
    const encoded = encodeBase64(content);
    const formatted = `${encoded.slice(0, 8)}\n${encoded.slice(8)}`;

    expect(decodeBase64(formatted)).toBe(content);
  });
});
