import {
  validateToken,
  validateRepository,
  upsertFile,
} from "@/services/github.service";
import { getSettings, saveSettings } from "@/storage/settings.storage";
import {
  hasProcessedSubmission,
  saveLatestSubmission,
  getSubmissionById,
} from "@/storage/submission.storage";
import { syncSubmission } from "@/services/sync.service";
import { SubmissionSchema } from "@/schemas/submission.schema";
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

const leetcodeSender = {
  url: "https://leetcode.com/submissions/detail/12345/",
};

const validSubmission = SubmissionSchema.parse({
  submissionId: "12345",
  problemId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  language: "typescript",
  languageName: "TypeScript",
  code: "console.log('Hello World');",
  topics: [
    {
      name: "Array",
      slug: "array",
    },
  ],
  url: "https://leetcode.com/problems/two-sum/submissions/12345/",
  submittedAt: "2026-11-20T10:00:00.000Z",
  status: "Accepted",
});

const successfulSyncResult = {
  success: true,
  status: "synced" as const,
  filePath: "Easy/1-two-sum/solution.ts",
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

  describe("LEETCODE_SUBMISSION_CAPTURED", () => {
    it("should reject messages from untrusted URLs", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission: validSubmission,
        },
        {
          url: "https://example.com/",
        },
      );

      expect(response).toEqual({
        success: false,
        error: "Untrusted message source.",
      });

      expect(hasProcessedSubmission).not.toHaveBeenCalled();
      expect(saveLatestSubmission).not.toHaveBeenCalled();
      expect(syncSubmission).not.toHaveBeenCalled();
    });

    it("should reject invalid submission data", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission: {
            submissionId: "12345",
            status: "Wrong",
          },
        },
        leetcodeSender,
      );

      expect(response).toEqual({
        success: false,
        error: "Invalid submission data.",
      });

      expect(hasProcessedSubmission).not.toHaveBeenCalled();
      expect(saveLatestSubmission).not.toHaveBeenCalled();
    });

    it("should ignore already processed submissions", async () => {
      vi.mocked(hasProcessedSubmission).mockResolvedValue(true);

      const response = await handleBackgroundMessage(
        {
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission: validSubmission,
        },
        leetcodeSender,
      );

      expect(response).toEqual({
        success: true,
        duplicate: true,
      });

      expect(saveLatestSubmission).not.toHaveBeenCalled();
      expect(syncSubmission).not.toHaveBeenCalled();
    });

    it("should save and automatically sync a new submission", async () => {
      vi.mocked(hasProcessedSubmission).mockResolvedValue(false);
      vi.mocked(saveLatestSubmission).mockResolvedValue(undefined);
      vi.mocked(syncSubmission).mockResolvedValue(successfulSyncResult);

      const response = await handleBackgroundMessage(
        {
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission: validSubmission,
        },
        leetcodeSender,
      );

      expect(response).toEqual({
        success: true,
        duplicate: false,
        sync: successfulSyncResult,
      });

      expect(hasProcessedSubmission).toHaveBeenCalledWith("12345");
      expect(saveLatestSubmission).toHaveBeenCalledWith(validSubmission);
      expect(syncSubmission).toHaveBeenCalledWith(validSubmission, "automatic");
    });
  });

  describe("MANUAL_SYNC_REQUEST", () => {
    it("should reject messages from untrusted senders", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "MANUAL_SYNC_REQUEST",
          submissionId: "12345",
        },
        {
          id: "untrusted-extension",
        },
      );

      expect(response).toEqual({
        success: false,
        error: "Untrusted message source.",
      });

      expect(getSubmissionById).not.toHaveBeenCalled();
      expect(syncSubmission).not.toHaveBeenCalled();
    });

    it("should reject invalid submission IDs", async () => {
      const response = await handleBackgroundMessage(
        {
          type: "MANUAL_SYNC_REQUEST",
          submissionId: "abc123",
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: false,
        error: "Invalid submission ID.",
      });

      expect(getSubmissionById).not.toHaveBeenCalled();
    });

    it("should return an error when submission is not found", async () => {
      vi.mocked(getSubmissionById).mockResolvedValue(null);

      const response = await handleBackgroundMessage(
        {
          type: "MANUAL_SYNC_REQUEST",
          submissionId: "12345",
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: false,
        error: "Submission not found.",
      });

      expect(syncSubmission).not.toHaveBeenCalled();
    });

    it("should manually sync an existing submission", async () => {
      vi.mocked(getSubmissionById).mockResolvedValue(validSubmission);
      vi.mocked(syncSubmission).mockResolvedValue(successfulSyncResult);

      const response = await handleBackgroundMessage(
        {
          type: "MANUAL_SYNC_REQUEST",
          submissionId: "12345",
        },
        extensionSender,
      );

      expect(response).toEqual({
        success: true,
        sync: successfulSyncResult,
        error: undefined,
      });

      expect(getSubmissionById).toHaveBeenCalledWith("12345");
      expect(syncSubmission).toHaveBeenCalledWith(validSubmission, "manual");
    });
  });
});
