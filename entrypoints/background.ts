import { SubmissionSchema } from "@/schemas/submission.schema";
import { syncSubmission } from "@/services/sync.service";
import {
  getLatestSubmission,
  hasProcessedSubmission,
  saveLatestSubmission,
} from "@/storage/submission.storage";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // LeetCode submission capture
    if (message?.type === "LEETCODE_SUBMISSION_CAPTURED") {
      if (!sender.url?.startsWith("https://leetcode.com/")) {
        sendResponse({
          success: false,
          error: "Untrusted message source.",
        });

        return;
      }

      const parsed = SubmissionSchema.safeParse(message.submission);

      if (!parsed.success) {
        sendResponse({
          success: false,
          error: "Invalid submission data.",
        });

        return;
      }

      void (async () => {
        try {
          const submission = parsed.data;

          const exists = await hasProcessedSubmission(submission.submissionId);

          if (exists) {
            sendResponse({
              success: true,
              duplicate: true,
            });

            return;
          }

          await saveLatestSubmission(submission);

          // The sync service checks the configured sync mode.
          const syncResult = await syncSubmission(submission, "automatic");

          sendResponse({
            success: true,
            duplicate: false,
            sync: syncResult,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not process submission.",
          });
        }
      })();

      return true;
    }

    // Manual sync request from the extension popup
    if (message?.type === "MANUAL_SYNC_REQUEST") {
      if (sender.id !== browser.runtime.id) {
        sendResponse({
          success: false,
          error: "Untrusted message source.",
        });

        return;
      }

      const submissionId = message.submissionId;

      if (typeof submissionId !== "string" || !/^\d+$/.test(submissionId)) {
        sendResponse({
          success: false,
          error: "Invalid submission ID.",
        });

        return;
      }

      void (async () => {
        try {
          const submission = await getLatestSubmission();

          if (!submission || submission.submissionId !== submissionId) {
            sendResponse({
              success: false,
              error: "Submission not found.",
            });

            return;
          }

          const result = await syncSubmission(submission, "manual");

          sendResponse({
            success: result.success,
            sync: result,
            error: result.success ? undefined : result.message,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not sync submission.",
          });
        }
      })();

      return true;
    }

    return;
  });
});
