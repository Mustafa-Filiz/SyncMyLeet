import { describe, expect, it } from "vitest";

import { encodeBase64 } from "../utils/base64";

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
