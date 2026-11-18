import { waitForAcceptedSubmission } from "@/services/leetcode.service";
import { browser } from "wxt/browser";

const SUBMISSION_URL_REGEX = /\/submissions\/(?:detail\/)?(\d+)/;

function getSubmissionId(url: string): string | null {
  const match = url.match(SUBMISSION_URL_REGEX);

  return match?.[1] ?? null;
}

export default defineContentScript({
  matches: ["https://leetcode.com/*"],

  runAt: "document_idle",

  main(ctx) {
    const processedIds = new Set<string>();

    let currentUrl = "";

    async function captureSubmission(submissionId: string, url: string) {
      if (processedIds.has(submissionId)) {
        return;
      }

      processedIds.add(submissionId);

      try {
        console.info("[LeetCode Sync] Submission detected:", submissionId);

        const submission = await waitForAcceptedSubmission(submissionId, url);

        if (!submission) {
          console.info("[LeetCode Sync] Submission was not accepted.");

          return;
        }

        const response = await browser.runtime.sendMessage({
          type: "LEETCODE_SUBMISSION_CAPTURED",
          submission,
        });

        if (!response?.success) {
          throw new Error(response?.error ?? "Failed to save submission.");
        }

        console.info("[LeetCode Sync] Submission captured:", submission.title);
      } catch (error) {
        console.error("[LeetCode Sync] Capture failed:", error);

        // Allow retry if a temporary request error occurs.
        processedIds.delete(submissionId);
      }
    }

    function checkUrl() {
      const url = window.location.href;

      if (url === currentUrl) {
        return;
      }

      currentUrl = url;

      const submissionId = getSubmissionId(url);

      if (!submissionId) {
        return;
      }

      void captureSubmission(submissionId, url);
    }

    checkUrl();

    const interval = window.setInterval(checkUrl, 500);

    ctx.onInvalidated(() => {
      window.clearInterval(interval);
    });
  },
});
