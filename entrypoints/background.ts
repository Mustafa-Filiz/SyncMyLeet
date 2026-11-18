import { SubmissionSchema } from "@/schemas/submission.schema";
import {
  hasProcessedSubmission,
  saveLatestSubmission,
} from "@/storage/submission.storage";
import { browser } from "wxt/browser";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "LEETCODE_SUBMISSION_CAPTURED") {
      return;
    }

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

        sendResponse({
          success: true,
          duplicate: false,
        });
      } catch {
        sendResponse({
          success: false,
          error: "Could not save submission.",
        });
      }
    })();

    return true;
  });
});
