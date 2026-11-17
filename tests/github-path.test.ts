import { describe, expect, it } from "vitest";

import { encodeGitHubPath } from "../utils/github-path";

describe("encodeGitHubPath", () => {
  it("should preserve folder separators", () => {
    expect(encodeGitHubPath("solutions/easy/two-sum/typescript.ts")).toBe(
      "solutions/easy/two-sum/typescript.ts",
    );
  });

  it("should encode special characters", () => {
    expect(encodeGitHubPath("solutions/my problem/file.ts")).toBe(
      "solutions/my%20problem/file.ts",
    );
  });
});
