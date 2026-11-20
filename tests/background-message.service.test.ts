import {
  validateToken,
  validateRepository,
  upsertFile,
} from "@/services/github.service";
import { getSettings, saveSettings } from "@/storage/settings.storage";
import { handleBackgroundMessage } from "@/services/background-message.service";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/github.service", () => ({
  validateToken: vi.fn(),
  validateRepository: vi.fn(),
  upsertFile: vi.fn(),
}));

vi.mock("@/services/sync.service", () => ({
  syncSubmission: vi.fn(),
}));

vi.mock("@/storage/settings.storage", () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/storage/submission.storage", () => ({
  hasProcessedSubmission: vi.fn(),
  saveLatestSubmission: vi.fn(),
  getSubmissionById: vi.fn(),
}));

vi.mock("wxt/browser", () => ({
  browser: {
    runtime: {
      id: "test-extension-id",
    },
  },
}));

const validSettings = {
  token: "github_pat_test",
  owner: "test-user",
  repo: "leetcode-solutions",
  syncMode: "both" as const,
};

const extensionSender = {
  id: "test-extension-id",
};

describe("handleBackgroundMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GITHUB_CONNECT", () => {
    it("should connect and save valid settings", async () => {
      vi.mocked(validateToken).mockResolvedValue({
        login: "test-user",
        avatar_url: "https://example.com/avatar.png",
      });

      vi.mocked(validateRepository).mockResolvedValue({
        full_name: "test-user/leetcode-solutions",
        private: false,
        default_branch: "main",
        permissions: {
          push: true,
        },
      });

      const response = await handleBackgroundMessage(
        {
          type: "GITHUB_CONNECT",
          settings: validSettings,
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: true,
        username: "test-user",
        repository: "test-user/leetcode-solutions",
      });

      expect(saveSettings).toHaveBeenCalledWith(validSettings);
    });

    it("should reject invalid settings", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "GITHUB_CONNECT",
          settings: {
            ...validSettings,
            token: "",
          },
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: false,
        error: "Token is required",
      });

      expect(validateToken).not.toHaveBeenCalled();
      expect(saveSettings).not.toHaveBeenCalled();
    });

    it("should reject repositories without write permission", async () => {
      vi.mocked(validateToken).mockResolvedValue({
        login: "test-user",
        avatar_url: "https://example.com/avatar.png",
      });

      vi.mocked(validateRepository).mockResolvedValue({
        full_name: "test-user/leetcode-solutions",
        private: false,
        default_branch: "main",
        permissions: {
          push: false,
        },
      });

      const response = await handleBackgroundMessage(
        {
          type: "GITHUB_CONNECT",
          settings: validSettings,
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: false,
        error: "You do not have write access to this repository.",
      });

      expect(saveSettings).not.toHaveBeenCalled();
    });

    it("should reject messages from untrusted senders", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "GITHUB_CONNECT",
          settings: validSettings,
        },
        {
          id: "untrusted-extension",
        },
      );

      expect(response).toEqual({
        success: false,
        error: "Untrusted message source.",
      });

      expect(validateToken).not.toHaveBeenCalled();
    });
  });

  describe("GITHUB_TEST_SYNC", () => {
    it("should upload the connection test file", async () => {
      vi.mocked(validateToken).mockResolvedValue({
        login: "test-user",
        avatar_url: "https://example.com/avatar.png",
      });

      vi.mocked(validateRepository).mockResolvedValue({
        full_name: "test-user/leetcode-solutions",
        private: false,
        default_branch: "main",
        permissions: {
          push: true,
        },
      });

      vi.mocked(getSettings).mockResolvedValue(validSettings);

      vi.mocked(upsertFile).mockResolvedValue({} as never);

      const response = await handleBackgroundMessage(
        {
          type: "GITHUB_TEST_SYNC",
          settings: validSettings,
        },
        extensionSender,
      );

      expect(response).toMatchObject({
        success: true,
        username: "test-user",
        repository: "test-user/leetcode-solutions",
        message: "Test file successfully synced!",
      });

      expect(upsertFile).toHaveBeenCalledWith(
        expect.objectContaining({
          token: validSettings.token,
          owner: validSettings.owner,
          repo: validSettings.repo,
          path: "leetcode-sync/connection-test.md",
        }),
      );
    });
  });
});
