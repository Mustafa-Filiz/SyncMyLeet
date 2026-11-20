import { GitHubSettingsSchema } from "../schemas/settings.schema";
import { SubmissionSchema } from "../schemas/submission.schema";
import {
  validateToken,
  validateRepository,
  upsertFile,
} from "../services/github.service";
import { syncSubmission } from "../services/sync.service";
import { getSettings, saveSettings } from "../storage/settings.storage";
import {
  hasProcessedSubmission,
  saveLatestSubmission,
  getSubmissionById,
} from "../storage/submission.storage";
import { browser } from "wxt/browser";

interface MessageSender {
  id?: string;
  url?: string;
}

type MessageResponse = Record<string, unknown>;

async function validateAndSaveGitHubSettings(input: unknown) {
  const parsed = GitHubSettingsSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Invalid GitHub settings.",
    );
  }

  const settings = parsed.data;
  const user = await validateToken(settings.token);

  const repository = await validateRepository(
    settings.token,
    settings.owner,
    settings.repo,
  );

  if (!repository.permissions?.push) {
    throw new Error("You do not have write access to this repository.");
  }

  await saveSettings(settings);

  return {
    username: user.login,
    repository: repository.full_name,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function handleBackgroundMessage(
  message: unknown,
  sender: MessageSender,
): Promise<MessageResponse | undefined> {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  const payload = message as Record<string, unknown>;

  // LeetCode submission capture
  if (payload.type === "LEETCODE_SUBMISSION_CAPTURED") {
    if (!sender.url?.startsWith("https://leetcode.com/")) {
      return {
        success: false,
        error: "Untrusted message source.",
      };
    }

    const parsed = SubmissionSchema.safeParse(payload.submission);

    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid submission data.",
      };
    }

    try {
      const submission = parsed.data;

      const exists = await hasProcessedSubmission(submission.submissionId);

      if (exists) {
        return {
          success: true,
          duplicate: true,
        };
      }

      await saveLatestSubmission(submission);

      const syncResult = await syncSubmission(submission, "automatic");

      return {
        success: true,
        duplicate: false,
        sync: syncResult,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, "Could not process submission."),
      };
    }
  }

  // GitHub connection validation
  if (payload.type === "GITHUB_CONNECT") {
    if (sender.id !== browser.runtime.id) {
      return {
        success: false,
        error: "Untrusted message source.",
      };
    }

    try {
      const result = await validateAndSaveGitHubSettings(payload.settings);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, "GitHub connection failed."),
      };
    }
  }

  // GitHub test sync
  if (payload.type === "GITHUB_TEST_SYNC") {
    if (sender.id !== browser.runtime.id) {
      return {
        success: false,
        error: "Untrusted message source.",
      };
    }

    try {
      const result = await validateAndSaveGitHubSettings(payload.settings);

      const settings = await getSettings();

      await upsertFile({
        token: settings.token,
        owner: settings.owner,
        repo: settings.repo,
        path: "leetcode-sync/connection-test.md",
        content: [
          "# LeetCode Sync",
          "",
          "GitHub integration is working!",
          "",
          `Last tested: ${new Date().toISOString()}`,
        ].join("\n"),
        message: "test: verify GitHub integration",
      });

      return {
        success: true,
        ...result,
        message: "Test file successfully synced!",
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, "GitHub test sync failed."),
      };
    }
  }

  // Manual sync request
  if (payload.type === "MANUAL_SYNC_REQUEST") {
    if (sender.id !== browser.runtime.id) {
      return {
        success: false,
        error: "Untrusted message source.",
      };
    }

    const submissionId = payload.submissionId;

    if (typeof submissionId !== "string" || !/^\d+$/.test(submissionId)) {
      return {
        success: false,
        error: "Invalid submission ID.",
      };
    }

    try {
      const submission = await getSubmissionById(submissionId);

      if (!submission || submission.submissionId !== submissionId) {
        return {
          success: false,
          error: "Submission not found.",
        };
      }

      const result = await syncSubmission(submission, "manual");

      return {
        success: result.success,
        sync: result,
        error: result.success ? undefined : result.message,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, "Could not sync submission."),
      };
    }
  }

  return undefined;
}
